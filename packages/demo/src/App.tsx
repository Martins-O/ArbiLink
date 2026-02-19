import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Header }   from '@/components/Header';
import Home         from '@/pages/Home';
import { Demo }     from '@/pages/Demo';
import Explorer     from '@/pages/Explorer';
import './styles/globals.css';

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1">
          <Routes>
            <Route path="/"         element={<Home />}     />
            <Route path="/demo"     element={<Demo />}     />
            <Route path="/explorer" element={<Explorer />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
