local grafana = import 'grafonnet/grafana.libsonnet';
local notifyGraph = import '_notifygraphpanel.libsonnet';
local breadcrumbsPanel = import '_breadcrumbspanel.libsonnet';

local checklist = import 'checklist.libsonnet';
local node = checklist.getNodeByUid('pcp-vector-checklist-cpu-user');
local parents = checklist.getParentNodes(node);

checklist.dashboard.new(node)
.addPanel(
  notifyGraph.panel.new(
    title='Intensive tasks in user-space [%]',
    datasource='$datasource',
    meta=notifyGraph.meta.new(
      name='CPU - Intensive tasks in user-space',
      metrics=[
        notifyGraph.metric.new(
          'hotproc.psinfo.utime',
          'time (in ms) spent executing user code since process started',
        ),
      ],
      urls=['https://access.redhat.com/articles/781993'],
      issues=['The hotproc.control.config does not have default setting and need to be root to set it. Can set it with: <code>sudo pmstore hotproc.control.config \'cpuburn > 0.05\'</code>'],
      parents=parents,
    ),
  ).addTargets([
    { expr: 'hotproc.psinfo.utime', format: 'time_series', legendFormat: '$instance' },
  ]), gridPos={
    x: 0,
    y: 3,
    w: 12,
    h: 9
  },
)
