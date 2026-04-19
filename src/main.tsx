import React from 'react'
import ReactDOM from 'react-dom/client'
import WaitlistPage from './WaitlistPage'
import './styles/tokens.css'
import './styles/Waitlist.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <WaitlistPage market="india" />
    </React.StrictMode>,
)
