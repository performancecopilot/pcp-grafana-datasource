import Poller from "../poller";
import DataStore from "../datastore";
import * as dateMock from 'jest-date-mock';

describe("Poller", () => {
    let ctx: { context: any, datastore: DataStore, poller: Poller } = {} as any;

    beforeEach(() => {
        ctx.context = {
            findMetricMetadata: jest.fn(),
            fetch: jest.fn()
        }
        ctx.datastore = new DataStore(ctx.context, 25000)
        ctx.poller = new Poller(ctx.context, ctx.datastore, 10000);
        dateMock.clear();
    });

    it("should poll", async () => {
        ctx.context.findMetricMetadata.mockReturnValue({});
        ctx.context.fetch.mockReturnValue({
            "timestamp": {
                "s": 5,
                "us": 2000
            },
            "values": [{
                "pmid": 633356298,
                "name": "bpftrace.scripts.script1.data.scalar",
                "instances": [{
                    "instance": -1,
                    "value": 45200,
                    "instanceName": null
                }]
            }]
        });

        ctx.poller.ensurePolling(["bpftrace.scripts.script1.data.scalar"]);
        await ctx.poller.poll();

        const result = ctx.datastore.queryTimeSeries(["bpftrace.scripts.script1.data.scalar"], 0, Infinity);
        const expected = [{
            "target": "bpftrace.scripts.script1.data.scalar",
            "datapoints": [
                [45200, 5002]
            ]
        }];
        expect(result).toStrictEqual(expected);
    });

    it("should add and remove metrics to poll", async () => {
        ctx.context.findMetricMetadata.mockReturnValue({});
        ctx.poller.ensurePolling(["metric1", "metric2", "metric3"]);
        ctx.poller.removeMetricsFromPolling(["metric2", "metric3"]);
        await ctx.poller.poll();

        expect(ctx.context.fetch).toHaveBeenCalledWith(["metric1"], true);
    });

    it("should remove metrics which weren't requested in a specified time period", async () => {
        ctx.context.findMetricMetadata.mockReturnValue({});
        ctx.poller.ensurePolling(["metric1", "metric2", "metric3"]);
        dateMock.advanceBy(7000);
        ctx.poller.ensurePolling(["metric1"]);
        dateMock.advanceBy(5000);

        // max age is 10s
        // metric1 was requested 5s back, metric2 and metric3 12s back
        ctx.poller.cleanupExpiredMetrics();
        await ctx.poller.poll();

        expect(ctx.context.fetch).toHaveBeenCalledWith(["metric1"], true);
    });

});
