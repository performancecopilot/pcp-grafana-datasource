import _ from 'lodash';
import { TimeSeriesResult, Datapoint, TableResult, TargetFormat } from './types';

export default class Transformations {

    constructor(private templateSrv: any) {
    }

    getLabel(target: string, legendFormat: string) {
        if (_.isEmpty(legendFormat)) {
            return target;
        }
        else {
            const targetSpl = target.split('.');
            let vars = {
                instance: { value: target },
                metric0: { value: targetSpl[targetSpl.length - 1] }
            };
            return this.templateSrv.replace(legendFormat, vars);
        }
    }

    updateLabels(targetResults: TimeSeriesResult[], target: any) {
        return targetResults.map((t: TimeSeriesResult) => {
            return { target: this.getLabel(t.target, target.legendFormat), datapoints: t.datapoints }
        });
    }

    transformToHeatmap(targetResults: TimeSeriesResult[]) {
        for (const target of targetResults) {
            // target name is the upper bound
            const match = target.target.match(/^(.+?)\-(.+?)$/);
            if (match) {
                target.target = match[2];
            }

            // round timestamps to one second - the heatmap panel calculates the x-axis size accordingly
            target.datapoints = target.datapoints.map(
                (dataPoint: Datapoint) => [dataPoint[0], Math.floor(dataPoint[1] / 1000) * 1000]
            );
        }
        return targetResults;
    }

    transformToTable(targetResults: TimeSeriesResult[]) {
        let tableText = "";
        if (targetResults.length > 0 && targetResults[0].datapoints.length > 0)
            tableText = targetResults[0].datapoints[0][0] as string;

        let table: TableResult = { columns: [], rows: [], type: 'table' };
        let lines = tableText.split('\n');
        let columnSizes: [number, number | undefined][] = [];

        for (let line of lines) {
            line = line.trim();
            if (line.length === 0 || line.includes("Ctrl-C"))
                continue;

            if (_.isEmpty(table.columns)) {
                let tableHeaders = line.split(/\s\s+/);
                for (let i = 0; i < tableHeaders.length; i++) {
                    const colStartAt = line.indexOf(tableHeaders[i]);
                    const colEndAt = i + 1 < tableHeaders.length ? line.indexOf(tableHeaders[i + 1]) - 1 : undefined;
                    table.columns.push({ text: tableHeaders[i] });
                    columnSizes.push([colStartAt, colEndAt]);
                }
            }
            else {
                let row = columnSizes.map((colSize: any) => line.substring(colSize[0], colSize[1]).trim());
                table.rows.push(row);
            }
        }
        return [table];
    }

    transform(targetResults: TimeSeriesResult[], target: any) {
        if (target.format === TargetFormat.TimeSeries)
            return this.updateLabels(targetResults, target);
        else if (target.format === TargetFormat.Heatmap)
            return this.transformToHeatmap(targetResults);
        else if (target.format == TargetFormat.Table)
            return this.transformToTable(targetResults);
        else
            throw { message: `Invalid target format '${target.format}', possible options: ${TargetFormat.TimeSeries}, ${TargetFormat.Heatmap}, ${TargetFormat.Table}` };
    }


}
