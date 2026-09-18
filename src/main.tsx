import { createRoot } from 'react-dom/client'
import './styles/app.css'
import { loadPantry } from './data/pantry'
import { App } from './components/App'

const root = createRoot(document.getElementById('root')!)
loadPantry()
  .then((loaded) => root.render(<App loaded={loaded} />))
  .catch((err: unknown) => {
    root.render(<pre>{String(err)}</pre>)
    throw err
  })
