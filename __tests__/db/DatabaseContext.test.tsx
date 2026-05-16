import React from 'react';
import { Text } from 'react-native';
import { render, waitFor } from '@testing-library/react-native';
import { DatabaseProvider, useDatabase } from '@/db/DatabaseContext';
import { createTestDatabase } from '@/db/testDatabase';

function Probe() {
  const db = useDatabase();
  return <Text testID="probe">{db ? 'ready' : 'pending'}</Text>;
}

describe('DatabaseProvider', () => {
  test('useDatabase throws вне provider', () => {
    const origErr = console.error;
    console.error = jest.fn(); // silence React errorBoundary warning
    expect(() => render(<Probe />)).toThrow(/DatabaseProvider/);
    console.error = origErr;
  });

  test('initialDatabase сразу резолвится', () => {
    const db = createTestDatabase();
    const { getByTestId } = render(
      <DatabaseProvider initialDatabase={db}><Probe /></DatabaseProvider>,
    );
    expect(getByTestId('probe').props.children).toBe('ready');
  });

  test('onReady вызывается с db', async () => {
    const db = createTestDatabase();
    const onReady = jest.fn();
    render(
      <DatabaseProvider initialDatabase={db} onReady={onReady}>
        <Probe />
      </DatabaseProvider>,
    );
    await waitFor(() => expect(onReady).toHaveBeenCalledWith(db));
  });

  test('children рендерятся только когда db non-null (initialDatabase)', () => {
    const db = createTestDatabase();
    const { getByTestId, queryByTestId } = render(
      <DatabaseProvider
        initialDatabase={db}
        fallback={<Text testID="loading">loading</Text>}
      >
        <Probe />
      </DatabaseProvider>,
    );
    // db non-null с initialDatabase → children, не fallback
    expect(getByTestId('probe')).not.toBeNull();
    expect(queryByTestId('loading')).toBeNull();
  });
});
