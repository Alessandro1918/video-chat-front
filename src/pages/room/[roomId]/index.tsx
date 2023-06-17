import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import Peer from "simple-peer";

// import styles from '@/styles/Home.module.css'

import { socket } from '../../../socket'

export default function Room() {

  interface PeerRefProps {
    peerId: string
    peer: Peer.Instance
  }

  const router = useRouter()                                  //get roomId from url

  const [ roomId, setRoomId ] = useState<any>(undefined)      //init var on the state to avoid multiple reloads
  const [ myUserId, setMyUserId ] = useState('')
  const [ isVideoOn, setIsVideoOn ] = useState(true) 
  const [ isAudioOn, setIsAudioOn ] = useState(true) 

  const myStreamRef = useRef<HTMLVideoElement>(null)
  // const [ stream, setStream ] = useState<MediaStream>()

  const peersRefs = useRef<PeerRefProps[]>([])                //ties the "Peer" object with it's socket.id
  const [ peers, setPeers ] = useState<Peer.Instance[]>([])   //map thru this array to get the users videos

  useEffect(() => {
    
    if (!router.isReady) return

    setRoomId(router.query.roomId)

    navigator.mediaDevices.getUserMedia({
      video: isVideoOn,
      audio: isAudioOn
    }).then(currentStream => {
      myStreamRef.current!.srcObject = currentStream
      // setStream(currentStream)

      socket.connect()
      socket.on("connect", () => {
        setMyUserId(socket.id)

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

        socket.emit("join-room", router.query.roomId)
      })
    })

    socket.on('new-user-joined-room', userId =>  {
      console.log(`User ${userId} entered the room`)
    })

    socket.on('new-message-to-room', (userId, message) => {
      console.log(`Message from user ${userId}: ${message}`)
    })

    socket.on('left-room', userId => {
      console.log(`User ${userId} left the room`)
      removeUser(userId)
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
      peersRefs.current.push({
        peerId: userId,
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

    peersRefs.current.push({
      peerId: callerId,
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
    const item = peersRefs.current.find(p => p.peerId === id)
    item!.peer.signal(signal)
  }

  //Delete disconnected user from my UI
  function removeUser(userId: string) {
    // TODO
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
        <h3>{`User: ${myUserId}`}</h3>
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
        <input 
          type="button" 
          value={isVideoOn ? "Video: ON" : "Video: OFF"} 
          onClick={() => setIsVideoOn(!isVideoOn)}
        />
        <input 
          type="button" 
          value={isAudioOn ? "Audio: ON" : "Audio: OFF"} 
          onClick={() => setIsAudioOn(!isAudioOn)}
        />
        {peers.map((peer, index) => {
        {/* {peersRefs.current.map((ref, index) => { */}
          return (
            <div key={index}>
              <PeerVideo key={index} peer={peer} />
              {/* <PeerVideo key={index} peer={ref.peer} /> */}
              <h3>{`User: ${peersRefs.current[index].peerId}`}</h3>
              {/* <h3>{`User: ${ref.peerId}`}</h3> */}
            </div>
          );
        })}
      </main>
    </>
  )
}
