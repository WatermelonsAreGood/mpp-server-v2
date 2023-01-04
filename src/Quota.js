export default class NewQuota {
    constructor(client, name, values = []) {
        this.values = values;

        this.client = client;
        this.name = name;
        this.client = client;
        this.selected = 0;
        this.force = 0;

        this.bypassed = this.client.user.flags.get("quotaBypass." + this.name);

        this.values.forEach((z, i) => {
            if(this.client.user.flags.get("quotaAlways." + this.name + "." + i)) this.force = i;
        })

        this.selected = this.force;

        this.interval = setInterval(()=>{
            let curr = values[this.selected];
            if(this.points < curr.max) {
                this.points += curr.allowance;
                if (this.points > curr.max) this.points =curr.max;
            }
        }, values[this.selected].interval)
    }

    getRaw() {
        console.log("recv getraw byp: " + this.bypassed)
        if(this.bypassed) {
            return {
                allowance: 99999,
                max: 99999,
                interval: 1000
            }
        }

        return this.values[this.selected];
    }

    isAvailable() {
        if(this.bypassed) return this.bypassed;
        if(this.points < 0) return false;
        this.points -= 1;
        return true;
    }

    updateFlags(n) {
        this.selected = this.force||n;
        if(this.values.length <= this.selected) this.selected = 0;
        this.points = this.values[this.selected].max;
    }
}
