import { io } from 'socket.io-client'

const URL_BACK = process.env.NEXT_PUBLIC_URL_BACK || "http://localhost:4000"

export const socket = io(URL_BACK, {
  autoConnect: false
})
