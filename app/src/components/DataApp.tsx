import { useState } from 'react';
import { Header } from './Header';
import { DataEntryForm } from './DataEntryForm';
import { DataRecords } from './DataRecords';
import '../styles/DataApp.css';

export function DataApp() {
  const [activeTab, setActiveTab] = useState<'create' | 'records'>('create');
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="data-app">
      <Header />
      <main className="data-main">
        <div className="tab-header">
          <button
            className={`tab-button ${activeTab === 'create' ? 'active' : ''}`}
            onClick={() => setActiveTab('create')}
          >
            Create record
          </button>
          <button
            className={`tab-button ${activeTab === 'records' ? 'active' : ''}`}
            onClick={() => setActiveTab('records')}
          >
            My records
          </button>
        </div>

        {activeTab === 'create' && (
          <DataEntryForm
            onCreated={() => {
              setActiveTab('records');
              setRefreshKey((value) => value + 1);
            }}
          />
        )}
        {activeTab === 'records' && <DataRecords refreshKey={refreshKey} />}
      </main>
    </div>
  );
}
