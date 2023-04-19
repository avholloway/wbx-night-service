import got from 'got';

export default defineComponent({
  props: {
    webex: {
      type: "app",
      app: "cisco_webex_custom_app",
    }
  },
  async run({steps, $}) {

    const html = content => `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta http-equiv="X-UA-Compatible" content="IE=edge">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Night Service</title>
        <style>
            body { color: #333; font-family: Tahoma, sans-serif; }
            .container { text-align: center; }
            .container div { margin-top: 1em; }
            .status-On { color: #0c0 }
            .status-Off { color: #c00 }
            button { font-size: 1.5em; padding: .25em .5em; }
        </style>
    </head>
    <body>
        <div class="container">
          ${content}
        </div>
    </body>
    </html>`;

    const locationId = steps.trigger.event.query.locationId;
    const queueId = steps.trigger.event.query.queueId;
    if (!locationId || !queueId) {
      const error = `Missing required query parameters: locationId and queueId`;
      await $.respond({ status: 200, body: html(error) });
      return $.flow.exit(error);
    }

    const webex_api_options = {
      prefixUrl: `https://webexapis.com/v1/telephony/config/locations/${locationId}/queues/${queueId}`,
      headers: {
        'Authorization': `Bearer ${this.webex.$auth.oauth_access_token}`
      }
    };

    const got_api_client = got.extend(webex_api_options);
    
    let queue;
    try {
      queue = await got_api_client.get().json();
    } catch(error) {
      await $.respond({ status: 200, body: html(error) });
      return $.flow.exit(error);
    }

    let night_service;
    try {
      night_service = await got_api_client.get('nightService').json();
    } catch(error) {
      await $.respond({ status: 200, body: html(error) });
      return $.flow.exit(error);
    }

    async function render_page() {
      const workflow_trigger = steps.trigger.event.headers.host;
      const current_state = night_service.forceNightServiceEnabled;
      const future_state = ! current_state;
      const change_url = `https://${workflow_trigger}?force=${future_state}&locationId=${locationId}&queueId=${queueId}`;

      const content = `<div><h1>${queue.name}</h1></div>
        <div><h2>Forced Night Service is <span class="status-${current_state ? 'On' : 'Off'}">${current_state ? 'On' : 'Off'}</span></h2></div>
        <div><button onclick="this.innerText='Saving...'; this.disabled=true; window.location.href='${change_url}';">Turn ${future_state ? 'On' : 'Off'}</button></div>`;

      await $.respond({ status: 200, body: html(content) });
    }

    if (steps.trigger.event.query.force === undefined) {
      await render_page();
      return $.flow.exit('force parameter not specified');
    }
    
    let force;
    if (steps.trigger.event.query.force === 'true') {
      force = true;
    } else if (steps.trigger.event.query.force === 'false') {
      force = false;
    } else {
      const error = `Query parameter: force, should be boolean true or false`;
      await $.respond({ status: 200, body: html(error) });
      return $.flow.exit(error);
    }

    if (force === night_service.forceNightServiceEnabled) {
      await render_page();
      return $.flow.exit('force value already matches current state');
    }

    night_service.forceNightServiceEnabled = force;

    try {
      await got_api_client.put('nightService', {json: night_service});
    } catch(error) {
      await $.respond({ status: 200, body: html(error) });
      return $.flow.exit(error);
    }

    await render_page();

  },
})
