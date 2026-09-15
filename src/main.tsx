import { createRoot } from 'react-dom/client'
import './styles/app.css'
import { loadPantry } from './data/pantry'
import { App } from './components/App'

const root = createRoot(document.getElementById('root')!)
loadPantry()
  .then(({ data, topology, adjacency, bubbles, similar }) =>
    root.render(
      <App
        data={data}
        topology={topology}
        adjacency={adjacency}
        bubbles={bubbles}
        similar={similar}
      />,
    ),
  )
  .catch((err: unknown) => {
    root.render(<pre>{String(err)}</pre>)
    throw err
  })
