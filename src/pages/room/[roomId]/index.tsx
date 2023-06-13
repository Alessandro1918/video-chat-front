import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'

// import styles from '@/styles/Home.module.css'

import { socket } from '../../../socket'

export default function Room() {

  const [ roomId, setRoomId ] = useState<any>(undefined)      //init var on the state to avoid multiple reloads
  const [ userId, setUserId ] = useState('')
  
  const router = useRouter()                                  //get roomId from url

  useEffect(() => {
    
    if (!router.isReady) return

    setRoomId(router.query.roomId)

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
      </main>
    </>
  )
}
