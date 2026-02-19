import { Link, Outlet, createRootRoute } from '@tanstack/react-router'

const RootLayout = (): React.JSX.Element => (
  <div className="app-shell">
    <header className="app-shell__header">
      <h1 className="app-shell__title">Wispr</h1>
      <nav className="app-shell__nav">
        <Link className="app-shell__link" to="/">
          Home
        </Link>
        <Link className="app-shell__link" to="/settings">
          Settings
        </Link>
      </nav>
    </header>
    <main className="app-shell__main">
      <Outlet />
    </main>
  </div>
)

export const Route = createRootRoute({ component: RootLayout })
