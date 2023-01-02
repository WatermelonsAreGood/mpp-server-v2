export default class NewQuota {
    constructor(values = []) {
        this.values = values;
        this.selected = 0;
        this.points = 0

        this.interval = setInterval(()=>{
            let curr = values[this.selected];
            if(this.points < curr.max) {
                this.points += curr.allowance;
                if (this.points > curr.max) this.points =curr.max;
            }
        }, values[this.selected].interval)
    }

    getRaw() {
        return this.values[this.selected];
    }

    isAvailable() {
        if(this.points < 0) return false;
        this.points -= 1;
        return true;
    }

    updateFlags(n) {
        if(this.values.length <= n) return;
        this.selected = n;
        this.points = this.values[this.selected].max;
    }
}
