import { useState } from 'react';
import { AppShell, MainContent, PageContent } from './components/layout/AppShell.tsx';
import { Sidebar, type PageId } from './components/layout/Sidebar.tsx';
import { Topbar } from './components/layout/Topbar.tsx';
import { LivePage } from './components/live/LivePage.tsx';
import { SessionPage } from './components/session/SessionPage.tsx';
import { HistoryPage } from './components/history/HistoryPage.tsx';
import { SettingsPage } from './components/settings/SettingsPage.tsx';
import { TestPage } from './components/test/TestPage.tsx';
import { TrainPage } from './components/train/TrainPage.tsx';
import { ProfilePage } from './components/profile/ProfilePage.tsx';

export default function App() {
  const [page, setPage] = useState<PageId>('live');

  return (
    <AppShell>
      <Sidebar activePage={page} onNavigate={setPage} />
      <MainContent>
        <Topbar onOpenProfilePage={() => setPage('profile')} />
        {page === 'live' ? (
          <LivePage onNavigate={setPage} />
        ) : (
          <PageContent>
            {page === 'train' && <TrainPage />}
            {page === 'test' && <TestPage />}
            {page === 'session' && <SessionPage />}
            {page === 'history' && <HistoryPage onNavigate={setPage} />}
            {page === 'profile' && <ProfilePage onNavigate={setPage} />}
            {page === 'settings' && <SettingsPage onNavigate={setPage} />}
          </PageContent>
        )}
      </MainContent>
    </AppShell>
  );
}
