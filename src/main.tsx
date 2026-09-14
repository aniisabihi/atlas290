import { createRoot } from 'react-dom/client'
import './styles/app.css'
import { loadPantry } from './data/pantry'
import { App } from './components/App'

const root = createRoot(document.getElementById('root')!)
loadPantry()
  .then(({ data, topology, adjacency, bubbles }) =>
    root.render(<App data={data} topology={topology} adjacency={adjacency} bubbles={bubbles} />),
  )
  .catch((err: unknown) => {
    root.render(<pre>{String(err)}</pre>)
    throw err
  })
