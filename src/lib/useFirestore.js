import { useEffect, useState } from 'react';
import { onSnapshot } from 'firebase/firestore';

// Live document. `makeRef` returns a DocumentReference or null (skip).
export function useDocument(makeRef, deps) {
  const [state, setState] = useState({ data: undefined, loading: true, error: null });
  useEffect(() => {
    const ref = makeRef();
    if (!ref) {
      setState({ data: null, loading: false, error: null });
      return undefined;
    }
    setState((s) => ({ ...s, loading: true }));
    return onSnapshot(
      ref,
      (snap) =>
        setState({
          data: snap.exists() ? { id: snap.id, ...snap.data() } : null,
          loading: false,
          error: null,
        }),
      (error) => setState({ data: null, loading: false, error }),
    );
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  return state;
}

// Live query. `makeQuery` returns a Query or null (skip).
export function useCollection(makeQuery, deps) {
  const [state, setState] = useState({ data: [], loading: true, error: null });
  useEffect(() => {
    const q = makeQuery();
    if (!q) {
      setState({ data: [], loading: false, error: null });
      return undefined;
    }
    setState((s) => ({ ...s, loading: true }));
    return onSnapshot(
      q,
      (snap) =>
        setState({
          data: snap.docs.map((d) => ({ id: d.id, ...d.data() })),
          loading: false,
          error: null,
        }),
      (error) => setState({ data: [], loading: false, error }),
    );
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  return state;
}
