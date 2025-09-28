const monthNames = [
    "Jan", "Feb", "Mar",
    "Apr", "May", "June", "July",
    "Aug", "Sept", "Oct",
    "Nov", "Dec"
];
const weekDays = [
    "Sun", "Mon", "Tue",
    "Wed", "Thu", "Fri",
    "Sat"
];

export function isSameDay(first: Date, second: Date) {
    return first.getDate() === second.getDate() &&
        first.getMonth() === second.getMonth() &&
        first.getFullYear() === second.getFullYear();
}

export function smartHandleDate(date: string|number): string {
    if (typeof date === 'string') {
        if (date.includes("T")) {
            return (new Date(date+"Z")).getTime().toString();
        }
    }
    return date.toString();
}

/**
 * Helper function to parse a date/time string and rewrite it as something
 * more human readable.
 * @param {String} timeString - the string representation of time ("YYYYMMDD HHMMSS")
 * @returns {String} - A human-readable time string.
 */
export function prettyPrintDateTime(timeString: string|number): string {
    /*let year = timeString.slice(0, 4),
        month = parseInt(timeString.slice(4, 6), 10)-1,
        day = timeString.slice(6, 8),
        hour = timeString.slice(9, 11),
        minutes = timeString.slice(11, 13),
        seconds = timeString.slice(13, 15);*/
    // TODO: Handle timezones correctly
    if (timeString === undefined) {
        return "Undefined Time";
    }
    let now = new Date();
    let past = new Date(timeString);
    if (isSameDay(now, past)) {
        return "Today at "+past.toLocaleTimeString();
    } else {
        let dayStr = weekDays[past.getDay()];
        let monthStr = monthNames[past.getMonth()];
        let date = dayStr + ", " + monthStr + " " + past.getDate();
        if (now.getFullYear() === past.getFullYear()) {
            return date + " at "+past.toLocaleTimeString();
        } else {
            return date + ", "+past.getFullYear() + " at "+past.toLocaleTimeString();
        }
    }
}

export function prettyPrintDateTimeString(timeString: string): string {
    /*let year = timeString.slice(0, 4),
        month = parseInt(timeString.slice(4, 6), 10)-1,
        day = timeString.slice(6, 8),
        hour = timeString.slice(9, 11),
        minutes = timeString.slice(11, 13),
        seconds = timeString.slice(13, 15);*/
    // TODO: Handle timezones correctly
    return prettyPrintDateTime(parseInt(smartHandleDate(timeString), 10));
}

export function prettyPrintDate(timeString: string): string {
    if (timeString === undefined) {
        return "Undefined Time";
    }
    let now = new Date();
    let past = new Date(parseInt(smartHandleDate(timeString), 10));
    if (isSameDay(now, past)) {
        return "Today";
    } else {
        let dayStr = weekDays[past.getDay()];
        let monthStr = monthNames[past.getMonth()];
        let date = dayStr + ", " + monthStr + " " + past.getDate();
        if (now.getFullYear() === past.getFullYear()) {
            return date;
        } else {
            return date + ", "+past.getFullYear();
        }
    }
}

export function prettyPrintTime(timeString: string): string {
    if (timeString === undefined) {
        return "Undefined Time";
    }
    let past = new Date(parseInt(smartHandleDate(timeString), 10));
    return past.toLocaleTimeString();
}

export function formatAmount(delta: number, sign: string, coarse: boolean = false, round: boolean = false) {
    const operation = round ? Math.round : Math.floor;
    let years = operation(delta / (365*3600*24));
    let days = operation(delta % (365*3600*24) / (3600*24));
    let hours = operation(delta % (3600*24) / 3600);
    let minutes = operation(delta % 3600 / 60);
    let seconds = operation(delta % 60);

    let yearsDisplay = `${years} year${years!==1? 's': ''}`;
    let daysDisplay = `${days} day${days!==1? 's': ''}`;
    let hoursDisplay = `${hours} hour${hours!==1? 's': ''}`;
    let minutesDisplay = `${minutes} minute${minutes!==1? 's': ''}`;
    let secondsDisplay = `${seconds} second${seconds!==1? 's': ''}`;

    if (coarse) {
        if (delta < -30) {
            return "Time past!";
        } else if (delta < 1) {
            return "At this time";
        } else if (delta < 60) {
            return "<1 minute" + sign;
        } else if (delta < 60 * 60) {
            return minutesDisplay + sign;
        } else if (delta < 24 * 60 * 60) {
            return hoursDisplay + ", " + minutesDisplay + sign;
        } else if (delta < 365 * 24 * 60 * 60) {
            return daysDisplay + ", " + hoursDisplay + sign;
        } else {
            return yearsDisplay + ", " + daysDisplay + sign;
        }
    } else {
        if (delta < 1) {
            return "At this time";
        } else if (delta < 60) {
            return secondsDisplay + sign;
        } else if (delta < 60 * 10) {
            return minutesDisplay + ", " + secondsDisplay + sign;
        } else if (delta < 60 * 60) {
            return minutesDisplay + sign;
        } else if (delta < 24 * 60 * 60) {
            return hoursDisplay + ", " + minutesDisplay + sign;
        } else if (delta < 365 * 24 * 60 * 60) {
            return daysDisplay + ", " + hoursDisplay + sign;
        } else {
            return yearsDisplay + ", " + daysDisplay + sign;
        }
    }
}

export function formatDuration(earlier: string, later: string) {
    if (earlier === null) {
        return "Never";
    }
    let timeEarlier = new Date(parseInt(smartHandleDate(earlier), 10));
    let timeLater = later === null ? new Date() : new Date(parseInt(smartHandleDate(later), 10));
    let delta = Math.abs(timeLater.getTime() - timeEarlier.getTime())/1000;
    let sign = timeLater.getTime() > timeEarlier.getTime() ? ' earlier' : ' later';

    return formatAmount(delta, sign);
}