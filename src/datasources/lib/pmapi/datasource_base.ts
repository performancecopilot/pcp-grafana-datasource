import {
    DataQueryRequest,
    DataQueryResponse,
    DataSourceApi,
    DataSourceInstanceSettings,
    MetricFindValue,
    ScopedVars,
} from '@grafana/data';
import { getBackendSrv, getTemplateSrv } from '@grafana/runtime';
import { getLogger } from 'loglevel';
import { PmApiService } from '../../../common/services/pmapi/PmApiService';
import { PmSeriesApiService } from '../../../common/services/pmseries/PmSeriesApiService';
import { GenericError } from '../../../common/types/errors';
import { interval_to_ms, isBlank } from '../../../common/utils';
import { processQueries } from './data_processor';
import { Poller } from './poller/poller';
import { QueryResult } from './poller/types';
import { MinimalPmapiQuery, PmapiDefaultOptions, PmapiOptions, PmapiQuery } from './types';
const log = getLogger('datasource_base');

export abstract class DataSourceBase<Q extends MinimalPmapiQuery, O extends PmapiOptions> extends DataSourceApi<Q, O> {
    url?: string;
    hostspec: string;
    retentionTimeMs: number;
    pmApiService: PmApiService;
    pmSeriesApiService: PmSeriesApiService;
    poller?: Poller;

    constructor(
        readonly instanceSettings: DataSourceInstanceSettings<O>,
        defaults: PmapiDefaultOptions,
        apiTimeoutMs: number
    ) {
        super(instanceSettings);
        this.url = instanceSettings.url;
        this.hostspec = instanceSettings.jsonData.hostspec ?? defaults.hostspec;
        this.retentionTimeMs = interval_to_ms(instanceSettings.jsonData.retentionTime ?? defaults.retentionTime);
        this.pmApiService = new PmApiService(getBackendSrv(), {
            dsInstanceSettings: instanceSettings,
            timeoutMs: apiTimeoutMs,
        });
        this.pmSeriesApiService = new PmSeriesApiService(getBackendSrv(), {
            dsInstanceSettings: instanceSettings,
            baseUrl: this.url!,
            timeoutMs: apiTimeoutMs,
        });
    }

    filterQuery(query: PmapiQuery): boolean {
        // remove targets with container hostspec set to empty string
        // happens in the Vector Container Overview dashboard, when selecting "All" and no containers are present
        // $container gets replaced with "", and then PCP returns values for all cgroups
        return !(query.hide === true || isBlank(query.expr) || /container=(&|$)/.test(query.hostspec ?? ''));
    }

    getUrlAndHostspec(query?: Q, scopedVars: ScopedVars = {}): { url: string; hostspec: string } {
        const url = getTemplateSrv().replace(query?.url ?? this.url ?? '', scopedVars);
        const orInTheQueryErrorText = query ? ' or in the query editor' : '';

        if (this.url?.startsWith('/api/datasources/proxy') && !isBlank(query?.url)) {
            // Grafana will send additional x-grafana headers, which make the CORS request fail
            throw new GenericError(
                'Please set the access mode to Browser in the datasource settings when using a custom URL for this panel.'
            );
        }

        if (isBlank(url)) {
            throw new GenericError(
                `Please specify a connection URL in the datasource settings${orInTheQueryErrorText}.`
            );
        }

        const hostspec = getTemplateSrv().replace(query?.hostspec ?? this.hostspec, scopedVars);
        if (isBlank(hostspec)) {
            throw new GenericError(
                `Please specify a host specification in the datasource settings${orInTheQueryErrorText}.`
            );
        }

        return { url, hostspec };
    }

    async metricFindQuery(query: string): Promise<MetricFindValue[]> {
        query = getTemplateSrv().replace(query.trim());
        const { url, hostspec } = this.getUrlAndHostspec();
        const context = await this.pmApiService.createContext(url, { hostspec });
        const metricValues = await this.pmApiService.fetch(url, { context: context.context, names: [query] });
        return metricValues.values[0].instances.map(instance => ({ text: instance.value.toString() }));
    }

    getDashboardRefreshInterval() {
        const interval = new URLSearchParams(window.location.search).get('refresh');
        return interval ? interval_to_ms(interval) : undefined;
    }

    abstract buildPmapiQuery(query: Q, scopedVars: ScopedVars): PmapiQuery;

    async query(request: DataQueryRequest<Q>): Promise<DataQueryResponse> {
        if (!this.poller) {
            return { data: [] };
        }
        const refreshInterval = this.getDashboardRefreshInterval();
        if (refreshInterval) {
            this.poller.setRefreshInterval(refreshInterval);
        }

        const queryResults = request.targets
            .map(query => this.buildPmapiQuery(query, request.scopedVars))
            .filter(this.filterQuery) // filter after applying template variables (maybe a template variable is empty)
            .map(query => this.poller?.query(request, query))
            .filter(result => result !== null) as QueryResult[];
        const data = processQueries(request, queryResults, this.poller.state.refreshIntervalMs / 1000);

        log.debug('query', request, data);
        return { data };
    }

    async testDatasource() {
        // only catches browser access mode and empty url
        // for server access mode the url is always /api/datasources/proxy/..., i.e. it's never empty
        if (isBlank(this.url)) {
            return {
                status: 'error',
                message: 'Empty URL. To use this data source, please configure the URL in the query editor.',
            };
        }

        try {
            const context = await this.pmApiService.createContext(this.url!, { hostspec: this.hostspec });
            const pmcdVersionMetric = await this.pmApiService.fetch(this.url!, {
                context: context.context,
                names: ['pmcd.version'],
            });
            return {
                status: 'success',
                message: `Data source is working, using Performance Co-Pilot ${pmcdVersionMetric.values[0].instances[0].value}`,
            };
        } catch (error) {
            return {
                status: 'error',
                message: `${error.message}. To use this data source, please configure the URL in the query editor.`,
            };
        }
    }
}
