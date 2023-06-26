import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import Peer from "simple-peer";

// import styles from '@/styles/Home.module.css'

import { socket } from '../../../socket'

export default function Room() {

  interface PeerProps {
    id: string              //id from the "socket.io" package
    peer: Peer.Instance     //peer from the "simple-peer" package
  }

  const router = useRouter()                                  //get roomId from url

  const [ roomId, setRoomId ] = useState<any>(undefined)
  const [ myUserId, setMyUserId ] = useState('')

  const myStreamRef = useRef<HTMLVideoElement>(null)
  // const [ stream, setStream ] = useState<MediaStream>()

  const refs = useRef<PeerProps[]>([])                              //ties the "Peer" object with it's socket.id
  const [ peers, setPeers ] = useState<Peer.Instance[]>([])         //map thru this array to get the users videos

  //Initial setup:
  useEffect(() => {
    
    if (!router.isReady) return

    setRoomId(router.query.roomId)

    socket.on('new-user-joined-room', userId =>  {
      console.log(`User ${userId} entered the room`)
    })

    socket.on('new-message-to-room', (userId, message) => {
      console.log(`Message from user ${userId}: ${message}`)
    })

    socket.on('left-room', userId => {
      console.log(`User ${userId} left the room`)
    })

    navigator.mediaDevices.getUserMedia({
      video: true,    //can be replaced by a state var
      audio: true     //can be replaced by a state var
    }).then(currentStream => {
      myStreamRef.current!.srcObject = currentStream
      // setStream(currentStream)

      //If those 2 listeners were outside the async function "getUserMedia", they would use the old value for "stream" (null), since "setStream" is also async
      socket.on('list-room-users', users =>  {
        console.log(`Users already in the room: ${users}`)
        createUsers(users, socket.id, currentStream)
      })

      socket.on('new-signal-available', payload =>  {
        console.log(`Got signal from new user in the room: user ${payload.callerId}`)
        addUser(payload.signal, payload.callerId, currentStream)
      })

      socket.on('return-signal-available', payload =>  {
        console.log(`Got signal from user already in the room: user ${payload.id}`)
        linkPeerToUser(payload.signal, payload.id)
      })

      socket.connect()
      socket.on("connect", () => {
        setMyUserId(socket.id)

        socket.emit("join-room", router.query.roomId)
      })
    })

    return () => {
      //Clean up:
      socket.off('new-user-joined-room')
      socket.off('new-message-to-room')
      socket.off('left-room')
      socket.disconnect()
    }
  }, [router.isReady])

  //Saves every user already in the room as a peer on my state/ref and send them my id/stream
  function createUsers(users: string[], myId: string, myStream: MediaStream) {
    const peers: Peer.Instance[] = []

    users.map(userId => {
      const peer = createPeer(userId, myId, myStream)
      refs.current.push({
        id: userId,
        peer,
      })
      peers.push(peer)
    })

    setPeers(peers)
  }

  //From my point of view (client), I`m starting the communication (initiator: true)
  function createPeer(receiverId: string, callerId: string, stream: MediaStream) {
    const peer = new Peer({
      initiator: true,
      trickle: false,
      stream,
    })

    peer.on("signal", signal => {
      socket.emit("send-signal", { receiverId, callerId, signal })
    })

    return peer
  }

  //Saves the new user in the room as a peer on my state/ref and send my id/stream
  function addUser(signal: Peer.SignalData, callerId: string, stream: MediaStream) {
    const peer = addPeer(signal, callerId, stream)

    refs.current.push({
      id: callerId,
      peer,
    })

    setPeers(users => [...users, peer])
  }

  //From my point of view (client), the other peer started the communication (initiator: false)
  function addPeer(incomingSignal: Peer.SignalData, callerId: string, stream: MediaStream) {
    const peer = new Peer({
      initiator: false,
      trickle: false,
      stream,
    })

    peer.on("signal", signal => {
      socket.emit("return-signal", { signal, callerId })
    })

    peer.signal(incomingSignal)

    return peer
  }

  //Join to the users's ref stream the incoming peer's signal
  function linkPeerToUser(signal: Peer.SignalData, id: string) {
    const item = refs.current.find(e => e.id === id)
    item!.peer.signal(signal)
  }

  //Returns a video element of one peer
  function PeerVideo(props: any) {
    const ref = useRef<HTMLVideoElement>(null)
  
    useEffect(() => {
      props.peer.on("stream", (stream: MediaStream) => {
        ref.current!.srcObject = stream
      })
    }, [])
  
    return (
      <div>
        <video 
          ref={ref} 
          autoPlay
          playsInline
          style={{ width: '400px', height: '300px' }}
        />
      </div>
    )
  }

  function sendMessageToRoom() {
    socket.emit(
      "send-message-to-room", 
      roomId, 
      myUserId, 
      `Room ${roomId} rules!`
    )
  }

  return (
    <>
      <main >
        <h1>{`Room: ${roomId}`}</h1>
        <input 
          type="button" 
          value="Send" 
          onClick={sendMessageToRoom}
        />
        <div>
          <video 
            ref={myStreamRef} 
            autoPlay 
            playsInline
            style={{ width: '400px', height: '300px' }}
          />
        </div>
        <h3>{`My ID: ${myUserId}`}</h3>
        {/* <input 
          type="button" 
          value={isVideoOn ? "Video: ON" : "Video: OFF"} 
          onClick={() => setIsVideoOn(!isVideoOn)}
        />
        <input 
          type="button" 
          value={isAudioOn ? "Audio: ON" : "Audio: OFF"} 
          onClick={() => setIsAudioOn(!isAudioOn)}
        /> */}

        {/** V1: Map state var */}
        {peers.map((peer, index) => {
        {/** V2: Map ref */}
        // {refs.current.map((ref, index) => { 
          return (
            <div key={index}>
              <PeerVideo peer={peer} />
              {/* <PeerVideo peer={ref.peer} /> */}
              <h3>{`User: ${refs.current[index].id}`}</h3>
              {/* <h3>{`User: ${ref.id}`}</h3> */}
            </div>
          );
        })}
      </main>
    </>
  )
}
