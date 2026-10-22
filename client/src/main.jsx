import React from 'react'
import ReactDOM from 'react-dom/client'
import { Provider } from 'react-redux'
import { BrowserRouter } from 'react-router-dom'
import { store } from './store/store'
import LenisProvider from './providers/LenisProvider'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <Provider store={store}>
            {/* 🔥 MAGIC FIX: basename="/admin" add kar diya */}
            <BrowserRouter basename="/admin">
                <App />
            </BrowserRouter>
        </Provider>
    </React.StrictMode>,
)