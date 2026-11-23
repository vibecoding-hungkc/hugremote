import { HostsView } from '../features/hosts/components/HostsView';
import { useHosts, usePins, useSetPins } from '../features/workspace/hooks/useWorkspace';

export function HostsPage() {
  const hosts = useHosts();
  const pins = usePins();
  const setPins = useSetPins();
  return (
    <HostsView
      hosts={hosts.data?.hosts ?? []}
      pins={pins.data ?? []}
      loading={hosts.isLoading || pins.isLoading}
      loadError={hosts.isError}
      configWarning={!!hosts.data?.warnings.length}
      onPins={(ids) => setPins.mutate(ids)}
      onReload={() => void hosts.refetch()}
    />
  );
}
