import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Header from './components/Header';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-950 text-white">
        <Header />
        <main className="max-w-[1920px] mx-auto p-8">
          <Routes>
            <Route path="/" element={<h1 className="text-2xl font-bold">მთავარი გვერდი (Home)</h1>} />
            <Route path="/sessions" element={<h1 className="text-2xl font-bold">სეანსების გვერდი (Sessions)</h1>} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;