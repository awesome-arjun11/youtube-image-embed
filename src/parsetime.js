/**
 * Parsing time formats 
 * Taken from https://github.com/fent/node-m3u8stream/blob/master/src/parse-time.ts
 */


const numberFormat = /^\d+$/;
const timeFormat = /^(?:(?:(\d+):)?(\d{1,2}):)?(\d{1,2})(?:\.(\d{3}))?$/;
const timeUnits = {
    ms: 1,
    s: 1000,
    m: 60000,
    h: 3600000,
};

export const parseTime = (time) => {
    if (typeof time === 'number') {
        return time;
    }
    if (numberFormat.test(time)) {
        return +time;
    }
    const firstFormat = timeFormat.exec(time);
    if (firstFormat) {
        return +(firstFormat[1] || 0) * timeUnits.h +
            +(firstFormat[2] || 0) * timeUnits.m +
            +firstFormat[3] * timeUnits.s +
            +(firstFormat[4] || 0);
    }
    else {
        let total = 0;
        const r = /(-?\d+)(ms|s|m|h)/g;
        let rs;
        while ((rs = r.exec(time)) != null) {
            total += +rs[1] * timeUnits[rs[2]];
        }
        return total;
    }
};