import { Navigate, Route, Routes } from "react-router-dom";
import { Landing } from "@/pages/Landing";
import { Login } from "@/pages/Login";
import { Track } from "@/pages/Track";
import { SellerHome } from "@/pages/SellerHome";
import { HubConsole } from "@/pages/HubConsole";
import { PartnerApp } from "@/pages/PartnerApp";
import { AdminHome } from "@/pages/AdminHome";
import { Sellers } from "@/pages/Sellers";
import { useAuth } from "@/context/AuthContext";

export function App() {
  const { tokens, role } = useAuth();

  function home() {
    if (!tokens) return <Navigate to="/login" replace />;
    switch (role) {
      case "ADMIN": return <AdminHome />;
      case "HUB": return <HubConsole />;
      case "PARTNER": return <PartnerApp />;
      default: return <SellerHome />;
    }
  }

  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/track" element={<Track />} />
      <Route path="/track/:trackingNumber" element={<Track />} />
      <Route path="/login" element={tokens ? <Navigate to="/app" replace /> : <Login />} />
      <Route path="/app" element={home()} />
      <Route
        path="/app/sellers"
        element={
          !tokens ? <Navigate to="/login" replace /> : role === "ADMIN" ? <Sellers /> : <Navigate to="/app" replace />
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
