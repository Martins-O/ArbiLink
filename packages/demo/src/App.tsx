import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Navbar   from '@/components/Navbar'
import Home     from '@/pages/Home'
import Demo     from '@/pages/Demo'
import Explorer from '@/pages/Explorer'

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1">
          <Routes>
            <Route path="/"         element={<Home />}     />
            <Route path="/demo"     element={<Demo />}     />
            <Route path="/explorer" element={<Explorer />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}
