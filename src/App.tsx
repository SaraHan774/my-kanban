import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Home } from './pages/Home';
import { PageView } from './pages/PageView';
import { Layout } from './components/Layout';
import './styles/global.css';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="/page/:pageId" element={<PageView />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
