let domain = "AUNWP";
let massResponse = [];
let barcodes = [];

const customers = JSON.parse(localStorage.getItem('customers'));
const normalSuburbs = JSON.parse(localStorage.getItem('normalSuburbs'));
const suburbs = JSON.parse(localStorage.getItem('suburbs'));

const bunnings = ["31776_15827930", "31776_15829515", "31776_15833744", "31776_15701817", "31776_15870428", "31776_15870561", "31776_15948061", "31776_15988797"];

const normalise = s => normalSuburbs[s] || s;
const cardinal = s => suburbs[s] || "UNK";
const rename = (name, id) => customers[id] || name;

async function mass() {
    let input = prompt("CSV consignments").split(",");
    massResponse = [];
    barcodes = [];
    input.forEach(con=>doMass(con));
}

async function doMass(con) {
    let resp = await c(con);
    const today = new Date().setHours(0, 0, 0, 0);
    if (resp[9] == null) {
        resp[9] = today;
    }
    const date = new Date(resp[9])
    date.setHours(0, 0, 0, 0);

    if (new Date(resp[9]) < new Date().setHours(0, 0, 0, 0)) {
        resp[9] = new Date(new Date().setHours(0,0,0,0)).toISOString();
    }
    resp[9] = new Date(resp[9]).toLocaleDateString();
    
    massResponse.push(`["${resp[1]} ${resp[2]} ${resp[3]} - ${resp[4]}","${resp[5]} ${resp[6]}","${resp[11]}","${resp[7]}","${resp[9]} 00:00","${resp[10]}","${resp[8]}"]`);
}

async function fetchData(endpoint, payload) {
    const response = await fetch(endpoint, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${sessionStorage.getItem("beareraccess")}`,
            "Content-Type": "application/json",
            "X-XSRF-TOKEN": document.cookie.split('; ')
                .find(c => c.startsWith('XSRF-TOKEN='))
                ?.split('=')[1]
        },
        body: JSON.stringify(payload),
    });
    return await response.json();
}

async function getOrderDetails(orderId, email) {
    const payload = {ordersRequest:{orderId, userName:email, domain:domain}};
    const data = await fetchData("/getOrderDetail", payload);
    let qty = 0, weight = 0, spaces = 0;
    let barcodes = [];
    let dg = new Map();
    const items = [];
    data.getOrdersResponse.getOrders[0].itemDetails.forEach((item) => {
        qty+=parseInt(item.quantity);
        weight+=parseInt(item.weight);
        spaces+=Math.ceil(parseInt(item.length)/125)*Math.ceil(parseInt(item.width)/125);
        items.push(`${item.length}x${item.width}x${item.height}`);
        barcodes.push(item.id);

        if (item.dgFlag == "Y") {
            let weight = 0;
            if (dg.has(item.dgClass)) {
                weight = dg.get(item.dgClass);
            }
            dg.set(item.dgClass, weight+parseInt(item.dgWeight));
        }
    });
    let ref = `${qty} ${weight}`;
    if (spaces > items.length) {
        ref+= ` ${spaces}SPC`;
    }
    dg.forEach((value, key)=>ref+=` DG${key}-${value}KG`);
    return [ref, items, dg, barcodes];
}

async function searchOrder(orderId, email) {
    const payload = {ordersRequest:{orderId, userName:email, domain:domain}};
    const data = await fetchData("/searchOrders", payload);
    let order = data.getOrdersResponse.getOrders[0];
    return [order.senderSuburb, order.senderName, order.rateServiceId || "G", order.rcvrProvince, order.senderProvince, order.sourceLocationId, order.latePickupDate, order.sourceLocation, order.rcvrSuburb];
}

async function c(orderId) {
    if (orderId.substring(0,3) == "DSC") {
        domain = "PLNAU";
    } else {
        domain = "AUNWP";
    }
    orderId = orderId.trim().toUpperCase();
    const email = document.getElementById("dhlEmail").value;
    localStorage.setItem("dhlEmail", email);
    try {
        const [search, details] = await Promise.all([
            searchOrder(orderId, email),
            getOrderDetails(orderId, email),
        ]);
        console.log(search);
        console.log(details);
        let notice = ``;

        if (search[4] != "VIC") {
            notice += `Consignment is being sent from ${search[4]}, not VIC!\n`;
        }

        const today = new Date().setHours(0, 0, 0, 0);
        if (search[6] == null) {
            search[6] = today;
        }
        const date = new Date(search[6])
        date.setHours(0, 0, 0, 0);
        if (date.valueOf() != today.valueOf()) {
            notice += `Consignment is not booked in for today: ${search[6].substring(0,10)}\n`;
        }

        console.log(search[5]);
        if (!bunnings.includes(search[5])) {
            search[8] = "";
        }

        details[3].forEach(bc=>barcodes.push(bc));
        
        localStorage.setItem("lookups", parseInt(localStorage.getItem("lookups"))+1);
        updateCounter();
        return [notice, cardinal(normalise(search[0].toLowerCase())), normalise(search[0].toLowerCase()).toUpperCase(), rename(search[1], search[5]), search[2][0], search[3], details[0], orderId, details[1], date.toISOString(), search[7], search[8]];
    } catch (error) {
        return [`Error fetching order info: ${error}`];
    }
}

function draw() {
    const container = document.createElement("div");
    container.style = "width:40%;text-align:left;bottom:0;right:0;position:absolute;background:slategrey;margin:2em;padding:1em;border-radius:10px;z-index:100000";

    const header = document.createElement("b");
    header.textContent = "FMTD-O";

    const login = document.createElement("input");
    login.placeholder = "DHL email";
    login.id = "dhlEmail";
    login.style = "margin-left:1em";

    const counter = document.createElement("i");
    counter.style = "margin-right:1em;float:right";
    counter.id = "lookupsCount";

    const input = document.createElement("input");
    input.placeholder = "Consignment no."
    input.style = "float:right";

    const button = document.createElement("button");
    button.textContent = "Get Consignment";
    button.style = "float:right";

    const title = document.createElement("input");
    title.readOnly = true;
    title.style = "width:100%;text-align:right";
    const ref = document.createElement("input");
    ref.readOnly = true;
    ref.style = "width:100%;text-align:right";
    const con = document.createElement("input");
    con.readOnly = true;
    con.style = "width:100%;text-align:right";
    const notice = document.createElement("p");
    notice.style = "margin:0";
    const csv = document.createElement("input");
    csv.readOnly = true;
    csv.style = "width:100%;text-align:right";

    button.addEventListener("click", async () => {
        resp = await c(input.value)
        let date = new Date(resp[9]);
        if (new Date(resp[9]) < new Date().setHours(0, 0, 0, 0)) {
            resp[9] = new Date(new Date().setHours(0,0,0,0)).toISOString();
        }
        resp[9] = new Date(resp[9]).toLocaleDateString();
        notice.textContent = resp[0];
        title.value = `${resp[1]} ${resp[2]} ${resp[3]} - ${resp[4]}`;
        ref.value = `${resp[5]} ${resp[6]}`;
        con.value = `${resp[7]}`;
        csv.value = `["${title.value}","${ref.value}","${resp[11]}","${con.value}","${resp[9]} 00:00","${resp[10]}","${resp[8]}"]`;
        input.value = ``;
    });
    title.addEventListener("click", writeClipboard);
    ref.addEventListener("click", writeClipboard);
    con.addEventListener("click", writeClipboard);
    csv.addEventListener("click", writeClipboard);
    container.append(header, login, button, input, counter, title, ref, con, csv, notice);
    document.body.appendChild(container);
}

function updateCounter() {
    document.getElementById("lookupsCount").innerHTML = localStorage.getItem("lookups");
}

async function writeClipboard() {
    await navigator.clipboard.writeText(this.value);
}

function init() {
    if (!localStorage.getItem("lookups")) {
        localStorage.setItem("lookups", 0);
    }
    draw();
    if (localStorage.getItem("dhlEmail")) {
        document.getElementById("dhlEmail").value = localStorage.getItem("dhlEmail");
    }
    updateCounter();
}

init();
