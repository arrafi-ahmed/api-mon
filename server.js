require("dotenv").config();
const express = require('express');
const axios = require('axios');
const crypto = require('crypto');

const app = express();
// solax
const baseURL_solax = process.env.baseURL_solax;
const sites_list_endpoint = process.env.sites_list_endpoint
const site_endpoint = process.env.site_endpoint;
const api_key_solax = process.env.api_key_solax;
const currentPage = 1;

app.get('/fetch_solax_data_daily', async (req, res) => {
    let current_page = 1;
    let total_page = 1;
    const today = new Date(req.query.t).toISOString().slice(0, 10); // Get today's date in YYYY-MM-DD format
    const resultData = [];

    do {
        try {
            const response = await axios.get(baseURL_solax + sites_list_endpoint, {
                params: {
                    tokenId: api_key_solax,
                    current: currentPage,
                }
            })

            const data = response.data;
            if (response.status === 200) {
                total_page = data.result.pageTotal;

                for (const site of data.result.invs) {
                    try {
                        const response_single_site_data = await axios.get(baseURL_solax + site_endpoint, {
                            params: {
                                tokenId: api_key_solax,
                                sn: site.sn
                            }
                        });

                        const single_site_data = response_single_site_data.data;
                        
                        if (response_single_site_data.status === 200) {
                            const is_updated_today = new Date(single_site_data.result.uploadTime).toISOString().slice(0, 10) === today;
                            const data_to_insert = {
                                inverter_id: site.inverterSN,
                                site_id: site.sn,
                                site_count: data.result.invTotal,
                                name: site.siteName,
                                address: site.siteName,
                                city: site.city,
                                country: site.country,
                                total_capacity: is_updated_today ? single_site_data.result.ratedPower : 0,
                                prod_now: is_updated_today ? single_site_data.result.acpower : 0,
                                prod_today: is_updated_today ? single_site_data.result.yieldtoday : 0,
                                prod_this_month: is_updated_today ? single_site_data.result.yieldtoday : 0,
                                annual_energy_prod: is_updated_today ? single_site_data.result.yieldtoday : 0,
                                created_at: today
                            };

                            resultData.push(data_to_insert);
                        }
                    } catch (error) {
                        console.error('Error fetching single site data:', error);
                    }
                }
            }
        } catch (error) {
            console.error('Error fetching data:', error);
        }

        current_page++;
    } while (current_page <= total_page);

    res.send(resultData);
});

// solis
const baseURL_solis = process.env.baseURL_solis;
const inverter_endpoint = process.env.inverter_endpoint;
const collector_endpoint = process.env.collector_endpoint;
const key = process.env.key;
const keySecret = process.env.keySecret;

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
