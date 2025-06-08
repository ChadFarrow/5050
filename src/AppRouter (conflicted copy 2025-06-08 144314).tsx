import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { HomePage } from '@/pages/HomePage';
import { FundraiserPage } from '@/pages/FundraiserPage';
import { CreateFundraiserPage } from '@/pages/CreateFundraiserPage';
import NotFound from '@/pages/NotFound';

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/fundraiser/:id" element={<FundraiserPage />} />
        <Route path="/create" element={<CreateFundraiserPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}