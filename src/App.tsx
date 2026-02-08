import { HashRouter, Routes, Route } from 'react-router-dom';
import { Home } from './pages/Home';
import { PageView } from './pages/PageView';
import { Layout } from './components/Layout';
import './styles/global.css';

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="/page/:pageId" element={<PageView />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}

export default App;
