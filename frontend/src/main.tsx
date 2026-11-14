import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import PatientLayout from './patient/PatientLayout.tsx'
import Home from './patient/Home.tsx'
import CheckIn from './patient/CheckIn.tsx'
import Activity from './patient/Activity.tsx'
import Trends from './patient/Trends.tsx'
import BrainSession from './patient/BrainSession.tsx'
import ReactionGame from './patient/ReactionGame.tsx'
import Privacy from './patient/Privacy.tsx'
import Crisis from './patient/Crisis.tsx'
import PatientList from './clinic/PatientList.tsx'
import PatientDetail from './clinic/PatientDetail.tsx'

const router = createBrowserRouter([
  { path: '/', element: <App /> },
  {
    path: '/patient/:pid',
    element: <PatientLayout />,
    children: [
      { index: true, element: <Home /> },
      { path: 'checkin', element: <CheckIn /> },
      { path: 'activity/:iid', element: <Activity /> },
      { path: 'trends', element: <Trends /> },
      { path: 'brain', element: <BrainSession /> },
      { path: 'game', element: <ReactionGame /> },
      { path: 'privacy', element: <Privacy /> },
      { path: 'crisis', element: <Crisis /> },
    ],
  },
  { path: '/clinic', element: <PatientList /> },
  { path: '/clinic/:pid', element: <PatientDetail /> },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
