import { createRoot } from 'react-dom/client'
import { loadPantry } from './pantry'
import { RenderCheck } from './RenderCheck'

const root = createRoot(document.getElementById('root')!)
loadPantry()
  .then(({ data, topology }) =>
    root.render(<RenderCheck data={data} topology={topology} year={2024} />),
  )
  .catch((err: unknown) => {
    root.render(<pre>{String(err)}</pre>)
    throw err
  })
