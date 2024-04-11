require("dotenv").config();
const express = require('express');
const axios = require('axios');
const crypto = require('crypto');

const app = express();

const baseURL_solis = process.env.baseURL_solis;
const inverter_endpoint = process.env.inverter_endpoint;
const collector_endpoint = process.env.collector_endpoint;
const key = process.env.key;
const keySecret = process.env.keySecret;

app.get('/fetch_solax_data_daily', async (req, res) => {
    try {
        const data = await axios.get('https://www.solaxcloud.com/proxyApp/proxy/api/getComprehensiveInfo.do?tokenId=20240212195932736804090&current=1')
        res.send(data);
    } catch (error) {
        console.error(error);
        res.status(500).send('Error fetching data from Solis API');
    }
})
app.get('/fetch_solis_data_daily', async (req, res) => {
    try {
        const body = JSON.stringify({
            pageNo: 1,
            pageSize: 100
        });
        const contentMd5 = crypto.createHash('md5').update(body).digest('base64');
        const gmdate = new Date().toUTCString();

        const generateSignature = (endpoint) => {
            const param = `POST\n${contentMd5}\napplication/json\n${gmdate}\n${endpoint}`;
            return crypto.createHmac('sha1', keySecret).update(param).digest('base64');
        };

        const inverter_sign = generateSignature(inverter_endpoint);
        const collector_sign = generateSignature(collector_endpoint);

        const headers = {
            "Content-type": "application/json;charset=UTF-8",
            "Date": gmdate
        };

        const inverterOptions = {
            headers: {
                ...headers,
                "Authorization": `API ${key}:${inverter_sign}`,
                "Content-MD5": contentMd5
            }
        };
        const collectorOptions = {
            headers: {
                ...headers,
                "Authorization": `API ${key}:${collector_sign}`,
                "Content-MD5": contentMd5
            }
        };

        const inverter_response = await axios.post(`${baseURL_solis}${inverter_endpoint}`, body, inverterOptions);
        const collector_response = await axios.post(`${baseURL_solis}${collector_endpoint}`, body, collectorOptions);

        const combinedData = {
            inverterData: inverter_response.data,
            collectorData: collector_response.data
        };

        res.send(combinedData);
    } catch (error) {
        console.error(error);
        res.status(500).send('Error fetching data from Solis API');
    }
})

const port = process.env.port;
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
