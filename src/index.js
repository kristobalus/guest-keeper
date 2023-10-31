
const axios = require('axios');
const restify = require('restify');
const pino = require('pino');
const path = require('path');
const fs = require('fs');

const TW_CONSUMER_KEY = '3nVuSoBZnx6U4vzUxf5w'
const TW_CONSUMER_SECRET = 'Bcs59EFbbsdF6Sl9Ng71smgStWEGwXXKSjYvPVt7qys'
const TW_ANDROID_BASIC_TOKEN = `Basic ${btoa(TW_CONSUMER_KEY+':'+TW_CONSUMER_SECRET)}`

const MAX_ACCOUNTS = 10;
const LOOP_INTERVAL_MS = 3_600_000;
const BACKOFF_INTERVAL = 86_400_000;
const proxies = require('./proxies')

const log = pino({
    level: "debug",
    name: "guest-keeper",
    transport: {
        target: "pino-pretty"
    }
})

const accountPath = path.join(process.env.DATA_PATH, 'accounts.json')

let accounts
try {
    accounts = JSON.parse(fs.readFileSync(accountPath).toString("utf-8"))
} catch (err) {
    accounts = []
}

function getRandomProxy() {
    const pos = Math.round(Math.random() * (proxies.length - 1))
    return proxies[pos] ? { proxy: proxies[pos] } : {}
}

async function getBearerToken() {

    const response = await axios({
            method: 'post',
            url: 'https://api.twitter.com/oauth2/token',
            headers: {
                Authorization: TW_ANDROID_BASIC_TOKEN,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            data: 'grant_type=client_credentials',
            ...( getRandomProxy() ?? {} )
        })

    const tmpTokenResponse = response.data
    const result = Object.values(tmpTokenResponse).join(" ")

    log.debug({
        status: response.status,
        statusText: response.statusText,
        response: response.data
    }, '...reading bearer_token')

    return result
}

async function getGuestToken(bearer_token) {
    const response = await axios({
        method: "post",
        url: 'https://api.twitter.com/1.1/guest/activate.json',
        headers: {
            Authorization: bearer_token
        },
        ...( getRandomProxy() ?? {} )
    })

    log.debug({
        status: response.status,
        statusText: response.statusText,
        response: response.data
    }, '...reading guest_token')

    const { guest_token } = response?.data ?? {}

    return guest_token
}

async function getFlowToken(bearer_token, guest_token) {

    const response = await axios({
        method: 'post',
        url: 'https://api.twitter.com/1.1/onboarding/task.json?flow_name=welcome&api_version=1&known_device_token=&sim_country_code=us',
        headers: {
            Authorization: bearer_token,
            'Content-Type': 'application/json',
            'User-Agent': 'TwitterAndroid/9.95.0-release.0 (29950000-r-0) ONEPLUS+A3010/9 (OnePlus;ONEPLUS+A3010;OnePlus;OnePlus3;0;;1;2016)',
            'X-Twitter-API-Version': 5,
            'X-Twitter-Client': 'TwitterAndroid',
            'X-Twitter-Client-Version': '9.95.0-release.0',
            'OS-Version': '28',
            'System-User-Agent': 'Dalvik/2.1.0 (Linux; U; Android 9; ONEPLUS A3010 Build/PKQ1.181203.001)',
            'X-Twitter-Active-User': 'yes',
            'X-Guest-Token': guest_token
        },
        data: '{"flow_token":null,"input_flow_data":{"country_code":null,"flow_context":{"start_location":{"location":"splash_screen"}},"requested_variant":null,"target_user_id":0},"subtask_versions":{"generic_urt":3,"standard":1,"open_home_timeline":1,"app_locale_update":1,"enter_date":1,"email_verification":3,"enter_password":5,"enter_text":5,"one_tap":2,"cta":7,"single_sign_on":1,"fetch_persisted_data":1,"enter_username":3,"web_modal":2,"fetch_temporary_password":1,"menu_dialog":1,"sign_up_review":5,"interest_picker":4,"user_recommendations_urt":3,"in_app_notification":1,"sign_up":2,"typeahead_search":1,"user_recommendations_list":4,"cta_inline":1,"contacts_live_sync_permission_prompt":3,"choice_selection":5,"js_instrumentation":1,"alert_dialog_suppress_client_events":1,"privacy_options":1,"topics_selector":1,"wait_spinner":3,"tweet_selection_urt":1,"end_flow":1,"settings_list":7,"open_external_link":1,"phone_verification":5,"security_key":3,"select_banner":2,"upload_media":1,"web":2,"alert_dialog":1,"open_account":2,"action_list":2,"enter_phone":2,"open_link":1,"show_code":1,"update_users":1,"check_logged_in_account":1,"enter_email":2,"select_avatar":4,"location_permission_prompt":2,"notifications_permission_prompt":4}}',
        ...( getRandomProxy() ?? {} )
    })

    log.debug({
        status: response.status,
        statusText: response.statusText,
        response: response.data
    }, '...reading flow_token')

    const { flow_token } = response?.data ?? {}

    return flow_token
}

async function getGuestAccount() {

    // The bearer token is immutable
    // Bearer AAAAAAAAAAAAAAAAAAAAAFXzAwAAAAAAMHCxpeSDG1gLNLghVe8d74hl6k4%3DRUMF4xAQLsbeBhTSRrCiQpJtxoGWeyHrDb5te2jpGskWDFW82F
    const bearer_token = await getBearerToken();
    const guest_token = await getGuestToken(bearer_token)
    const flow_token = await getFlowToken(bearer_token, guest_token)

    const response = await axios({
        method: 'post',
        url: 'https://api.twitter.com/1.1/onboarding/task.json',
        headers: {
            Authorization: bearer_token,
            'Content-Type': 'application/json',
            'User-Agent': 'TwitterAndroid/9.95.0-release.0 (29950000-r-0) ONEPLUS+A3010/9 (OnePlus;ONEPLUS+A3010;OnePlus;OnePlus3;0;;1;2016)',
            'X-Twitter-API-Version': 5,
            'X-Twitter-Client': 'TwitterAndroid',
            'X-Twitter-Client-Version': '9.95.0-release.0',
            'OS-Version': '28',
            'System-User-Agent': 'Dalvik/2.1.0 (Linux; U; Android 9; ONEPLUS A3010 Build/PKQ1.181203.001)',
            'X-Twitter-Active-User': 'yes',
            'X-Guest-Token': guest_token
        },
        data: '{"flow_token":"' + flow_token + '","subtask_inputs":[{"open_link":{"link":"next_link"},"subtask_id":"NextTaskOpenLink"}],"subtask_versions":{"generic_urt":3,"standard":1,"open_home_timeline":1,"app_locale_update":1,"enter_date":1,"email_verification":3,"enter_password":5,"enter_text":5,"one_tap":2,"cta":7,"single_sign_on":1,"fetch_persisted_data":1,"enter_username":3,"web_modal":2,"fetch_temporary_password":1,"menu_dialog":1,"sign_up_review":5,"interest_picker":4,"user_recommendations_urt":3,"in_app_notification":1,"sign_up":2,"typeahead_search":1,"user_recommendations_list":4,"cta_inline":1,"contacts_live_sync_permission_prompt":3,"choice_selection":5,"js_instrumentation":1,"alert_dialog_suppress_client_events":1,"privacy_options":1,"topics_selector":1,"wait_spinner":3,"tweet_selection_urt":1,"end_flow":1,"settings_list":7,"open_external_link":1,"phone_verification":5,"security_key":3,"select_banner":2,"upload_media":1,"web":2,"alert_dialog":1,"open_account":2,"action_list":2,"enter_phone":2,"open_link":1,"show_code":1,"update_users":1,"check_logged_in_account":1,"enter_email":2,"select_avatar":4,"location_permission_prompt":2,"notifications_permission_prompt":4}}',
        ...( getRandomProxy() ?? {} )
    })

    log.debug({
        status: response.status,
        statusText: response.statusText,
        response: response.data
    }, `...reading guest account`)

    const { subtasks } = response?.data ?? {}

    return (subtasks ?? []).find(task => task.subtask_id === 'OpenAccount')?.open_account
}

async function loop() {
    log.debug('fetching guest account')

    let account

    try {
        account = await getGuestAccount()
    } catch(err) {
        log.error(err)
    }

    if (account) {
        log.debug({ account }, `account fetched`)
        accounts.push(account)
        if (accounts.length > MAX_ACCOUNTS) {
            accounts.shift()
        }
        fs.writeFileSync(accountPath, JSON.stringify(accounts))
        log.debug(`...successfully fetched guest account, next loop in ${LOOP_INTERVAL_MS} millis`)
        setTimeout(loop, LOOP_INTERVAL_MS)
    } else {
        log.debug(`...failed to fetch account, next loop in ${BACKOFF_INTERVAL} millis`)
        setTimeout(loop, BACKOFF_INTERVAL)
    }
}

(async () => {
    await loop()
})().catch(err => console.log(err))

const server = restify.createServer();

server.get('/guest-accounts', function(req, res, next) {
    res.send(accounts)
    next();
});

server.listen(3000, function() {
    console.log('%s listening at %s', server.name, server.url);
});
