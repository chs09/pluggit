
module.exports = {
	now: function timestampNow() {
		function pad2(n) {
			return (n < 10 ? '0' : '') + n;
		}

		let d = new Date();
		return d.getFullYear() +
			pad2(d.getMonth() + 1) +
			pad2(d.getDate()) +
			pad2(d.getHours()) +
			pad2(d.getMinutes()) +
			pad2(d.getSeconds());
	},

	parseDate: function dateFromTimestamp(t) {
		let seconds = Math.trunc(t % 100);   t/=100;
		let minutes = Math.trunc(t % 100);   t/=100;
		let hours = Math.trunc(t % 100);     t/=100;
		let day = Math.trunc(t % 100);       t/=100;
		let month = Math.trunc(t % 100);     t/=100;
		let monthIndex = month - 1;
		let year = Math.trunc(t);
		return new Date(year, monthIndex, day, hours, minutes, seconds);
	},

	parseSeconds: function secondsFromTimestamp(t) {
		return this.parseDate(t).getTime() / 1000;
	}
};