import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'

// import styles from '@/styles/Home.module.css'

import { socket } from '../../../socket'

export default function Room() {

  const router = useRouter()                                  //get roomId from url

  const [ roomId, setRoomId ] = useState<any>(undefined)      //init var on the state to avoid multiple reloads
  const [ userId, setUserId ] = useState('')
  const [ isVideoOn, setIsVideoOn ] = useState(true) 
  const [ isAudioOn, setIsAudioOn ] = useState(true) 

  const myStreamRef = useRef<HTMLVideoElement>(null)
  // const [ stream, setStream ] = useState<MediaStream>()

  useEffect(() => {
    
    if (!router.isReady) return

    setRoomId(router.query.roomId)

    setupStream(isVideoOn, isAudioOn)

    socket.connect()
    socket.on("connect", () => {
      setUserId(socket.id)
      socket.emit("join-room", router.query.roomId)
    })

    socket.on('new-user-joined-room', userId =>  {
      console.log(`User ${userId} entered the room`)
    })

    socket.on('new-message-to-room', (userId, message) => {
      console.log(`Message from user ${userId}: ${message}`)
    })

    socket.on('left-room', userId => {
      console.log(`User ${userId} left the room`)
    })

    return () => {
      //Clean up:
      socket.off('new-user-joined-room')
      socket.off('new-message-to-room')
      socket.off('left-room')
      socket.disconnect()
    }
  }, [router.isReady])

  //Update stream each time the user change their audio/video configs
  useEffect(() => {
    setupStream(isVideoOn, isAudioOn)
  }, [isVideoOn, isAudioOn])

  //Configure stream based on local vars (stream should include video? Audio?)
  function setupStream(isVideoOn: boolean, isAudioOn: boolean) {
    if (!isVideoOn && !isAudioOn) {
      myStreamRef.current!.srcObject = null
      // setStream(undefined)
      return
    }
    navigator.mediaDevices.getUserMedia({
      video: isVideoOn,
      audio: isAudioOn
    }).then(currentStream => {
      myStreamRef.current!.srcObject = currentStream
      //setStream(currentStream)
    })
  }

  function sendMessageToRoom() {
    socket.emit(
      "send-message-to-room", 
      roomId, 
      userId, 
      `Room ${roomId} rules!`
    )
  }

  return (
    <>
      <main >
        <h1>{`Room: ${roomId}`}</h1>
        <h3>{`User: ${userId}`}</h3>
        <input 
          type="button" 
          value="Send" 
          onClick={sendMessageToRoom}
        />
        <div>
          <video 
            ref={myStreamRef} 
            autoPlay 
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
      </main>
    </>
  )
}
