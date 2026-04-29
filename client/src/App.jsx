// import AppRoutes from './routes/AppRoutes'

// function App() {
//     return (
//         <AppRoutes />
//     )
// }

// export default App


import { useEffect } from "react";
import { useDispatch } from "react-redux";
import { verifyAuth } from "@/store/slices/authSlice";
import AppRoutes from "./routes/AppRoutes";
import { ToastContainer } from "react-toastify";

export default function App() {
  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(verifyAuth()); // ✅ runs only once
  }, [dispatch]);

  return (
  <>
<AppRoutes />
<ToastContainer/>
</>
);
}