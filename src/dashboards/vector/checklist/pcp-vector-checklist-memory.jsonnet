local grafana = import 'grafonnet/grafana.libsonnet';
local notifyGraph = import '_notifygraphpanel.libsonnet';
local breadcrumbsPanel = import '_breadcrumbspanel.libsonnet';

local checklist = import 'checklist.libsonnet';
local node = checklist.getNodeByUid('pcp-vector-checklist-memory');
local parents = checklist.getParentNodes(node);

checklist.dashboard.new(node)
.addPanel(
  notifyGraph.panel.new(
    title='Swapping [# of pages]',
    datasource='$datasource',
    threshold=notifyGraph.threshold.new(
      metric='swap.pagesout',
      operator='>',
      value=1,
    ),
    meta=notifyGraph.meta.new(
      name='Memory - Swapping',
      warning='Not enough physical memory and data being moved out to swap space.',
      metrics=[
        notifyGraph.metric.new(
          'swap.pagesout',
          'pages written to swap devices due to demand for physical memory',
        ),
      ],
      urls=['https://access.redhat.com/articles/767563#cpu'],
      details='When the memory pressure is excessive the operating system will move data in memory to swap space on storage devices so that the memory can be use to store other data.  Data in swap will be moved back into memory as needed.  However, there is a cost for scanning memory for candidate data to move to swap and the cost of moving data between memory and swap space is high.',
      parents=parents,
      children=[checklist.getNodeByUid('pcp-vector-checklist-memory-swap')],
    ),
  ).addTargets([
    { expr: 'swap.pagesout', format: 'time_series', legendFormat: '$expr' },
  ]), gridPos={
    x: 0,
    y: 3,
    w: 12,
    h: 9
  },
)
.addPanel(
  notifyGraph.panel.new(
    title='Low mm reclaim efficiency [%]',
    datasource='$datasource',
    threshold=notifyGraph.threshold.new(
      metric='vmeff',
      operator='>',
      value=0.5,
    ),
    meta=notifyGraph.meta.new(
      name='Memory - Low mm reclaim efficiency',
      warning='The memory management system spending too much effort relaiming memory pages.',
      metrics=[
        notifyGraph.metric.new(
          'mem.vmstat.pgsteal_direct',
          'mem pages directly reclaimed',
        ),
        notifyGraph.metric.new(
          'mem.vmstat.pgsteal_kswapd',
          'mem pages reclaimed by kswapd',
        ),
        notifyGraph.metric.new(
          'mem.vmstat.pgscan_direct',
          'directly scanned mem pages',
        ),
        notifyGraph.metric.new(
          'mem.vmstat.pgscan_kswapd',
          'mem pages scanned by kswapd',
        ),
      ],
      derived=['vmeff = (rate(mem.vmstat.pgsteal_direct) + rate(mem.vmstat.pgsteal_kswapd)) / (rate(mem.vmstat.pgscan_direct) + rate(mem.vmstat.pgscan_kswapd))'],
      urls=['https://engineering.linkedin.com/performance/optimizing-linux-memory-management-low-latency-high-throughput-databases'],
      details='The linux virtual memory management system has a mechanism that places pages in memory into three lists: active, inactive, and free.  When a page is initially used it is put on the active list. Over time pages on the active list may fall off the end of the active list and be added to the inactive list as possible canidates to reclaim and to reuse for other data.  The inactive list is linearly scanned for possible pages to reclaim, but pages on the inactive list may have various reasons to disqualify them from being reclaimed.  This scanning of the inactive list for candidates to reclaim requires cpu processing.  One would like the the computer system to be efficient and avoid having to scan many pages on the inactive list to find few candidates to reclaim. This problem behavior can be observed with a low %vmeff in the \'sar -B\' output, a low number of pgsteal/s in relation to the sum of pgscank/s and pgscand/s.',
      issues=['The various aggregate pgsteal and pgscan pcp metrics do not currently exist', 'The specific pgsteal and pgscan metrics provided by vmstat vary between kernels'],
      parents=parents,
    ),
  ).addTargets([
    { name: 'vmeff', expr: '(rate(mem.vmstat.pgsteal_direct) + rate(mem.vmstat.pgsteal_kswapd)) / (rate(mem.vmstat.pgscan_direct) + rate(mem.vmstat.pgscan_kswapd))', format: 'time_series', legendFormat: '$expr' },
  ]), gridPos={
    x: 12,
    y: 3,
    w: 12,
    h: 9
  },
)
.addPanel(
  notifyGraph.panel.new(
    title='Huge defragmentation [ops]',
    datasource='$datasource',
    meta=notifyGraph.meta.new(
      name='Memory - huge page defragmentation',
      warning='The system is spending large amounts of time grouping small pages of memory together into contigious physical regions of memory.',
      metrics=[
        notifyGraph.metric.new(
          'mem.vmstat.thp_collapse_alloc',
          'transparent huge page collapse allocations',
        ),
        notifyGraph.metric.new(
          'mem.vmstat.thp_fault_alloc',
          'transparent huge page fault allocations',
        ),
        notifyGraph.metric.new(
          'mem.vmstat.thp_fault_fallback',
          'transparent huge page fault fallbacks',
        ),
      ],
      urls=['http://dl.acm.org/citation.cfm?id=2930834'],
      parents=parents,
    ),
  ).addTargets([
    { expr: 'mem.vmstat.thp_collapse_alloc', format: 'time_series', legendFormat: '$metric' },
    { expr: 'mem.vmstat.thp_fault_alloc', format: 'time_series', legendFormat: '$metric' },
    { expr: 'mem.vmstat.thp_fault_fallback', format: 'time_series', legendFormat: '$metric' },
  ]), gridPos={
    x: 0,
    y: 13,
    w: 12,
    h: 9
  },
)
.addPanel(
  notifyGraph.panel.new(
    title='Huge fragmentation [# of page splits]',
    datasource='$datasource',
    meta=notifyGraph.meta.new(
      name='Memory - huge page fragmentation',
      warning='The system is splitting large regions of memory (Huge pages) into small pages.',
      metrics=[
        notifyGraph.metric.new(
          'mem.vmstat.thp_split',
          'count of transparent huge page splits',
        ),
      ],
      urls=['https://engineering.linkedin.com/performance/optimizing-linux-memory-management-low-latency-high-throughput-databases'],
      details='The Transparent Huge Page (THP) mechanism in some situations can reduce the overhead caused by TLB misses by using a individual Translation Lookaside Buffer (TLB) entry that provide a virtual to physical mapping for a 2MB of region memory rather than requiring 512 TLB entries to providing the virtual to physical memory mapping 2MB of 4096 byte pages.  Thus, more memory can be address with the name number of TLB entries, reducing the number of expensive updates to the TLB to include a virtual to physical mapping that is not currently in the TLB. TLB entries are a very limited resource, ranging from dozens to hundreds of entries. There are cases where the THP mechanism may need to split the huge pages into the smaller pages or combine smallers pages into a larger page.  This can occur when the a huge page is moved between Non-Uniform Memory Access (NUMA) nodes to rebalance memory use (*). Monitoring the Performance Copilot metric mem.vmstat.thp_split (or /proc/vmstat thp_split) would indicate when the expensive splitting of huge pages is occurring.',
      issues=['The RHEL7 has mem.vmstat.thp_split (thp_split in /proc/vmstat is available but on Fedora 25 /proc/vmstat has thp_split_page and thp_split_pmd which do not match up with PCP\'s mem.vmstat.thp_split'],
      parents=parents,
    ),
  ).addTargets([
    { expr: 'mem.vmstat.thp_split', format: 'time_series', legendFormat: '$metric' },
  ]), gridPos={
    x: 12,
    y: 13,
    w: 12,
    h: 9
  },
)
