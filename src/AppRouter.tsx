import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ScrollToTop } from "./components/ScrollToTop";

import Index from "./pages/Index";
import Campaign from "./pages/Campaign";
import Demo from "./pages/Demo";
import NotFound from "./pages/NotFound";

export function AppRouter() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/fundraiser/:pubkey/:dTag" element={<Campaign />} />
        <Route path="/campaign/:pubkey/:dTag" element={<Campaign />} />
        <Route path="/:nip19" element={<Campaign />} />
        <Route path="/demo" element={<Demo />} />
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
export default AppRouter;