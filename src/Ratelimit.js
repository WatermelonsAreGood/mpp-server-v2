
export class RateLimit {
	constructor(interval_ms) {
		this.interval_ms = interval_ms || 0;
		this.after = 0;
	}

	attempt(time) {
		var time = time || Date.now();
		if(time < this.after) return false;
		this._after = time + this.interval_ms;
		return true;
	}

	setInterval(interval_ms) {
		this.after += interval_ms - this.interval_ms;
		this.interval_ms = interval_ms;
	}
}

export class RateLimitChain {
	constructor(num, interval_ms) {
		this.setNumAndInterval(num, interval_ms);
	}

	attempt(time) {
		var time = time || Date.now();
		for(var i = 0; i < this.chain.length; i++) {
			if(this.chain[i].attempt(time)) return true;
		}
		return false;
	};

	setNumAndInterval(num, interval_ms) {
		this.chain = [];
		for(var i = 0; i < num; i++) {
			this.chain.push(new RateLimit(interval_ms));
		}
	};
}
