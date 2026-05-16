import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import EvidenceDrawer from '../components/EvidenceDrawer';

const EvidenceDrawerContext = createContext(null);

export function EvidenceDrawerProvider({ children }) {
  const [state, setState] = useState({ open: false, payload: null });

  const openEvidence = useCallback((payload) => {
    setState({ open: true, payload });
  }, []);

  const closeEvidence = useCallback(() => {
    setState({ open: false, payload: null });
  }, []);

  const value = useMemo(
    () => ({ openEvidence, closeEvidence, payload: state.payload, open: state.open }),
    [openEvidence, closeEvidence, state]
  );

  return (
    <EvidenceDrawerContext.Provider value={value}>
      {children}
      <EvidenceDrawer
        open={state.open}
        payload={state.payload}
        onClose={closeEvidence}
      />
    </EvidenceDrawerContext.Provider>
  );
}

export function useEvidenceDrawer() {
  const ctx = useContext(EvidenceDrawerContext);
  if (!ctx) throw new Error('useEvidenceDrawer must be used within EvidenceDrawerProvider');
  return ctx;
}
