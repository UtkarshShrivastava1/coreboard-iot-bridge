# Transcript and Summary of Meeting

**Participants:** The Client and Manager Harish  

---

## Verbatim Transcription

**00:00 Manager:** Yes sir, what were you saying about the super admin, sir?

**00:02 Client:** Look, the first thing we need to address: wherever we go in the super admin to create a device, the device profile type cannot be fixed.

**00:15 Manager:** Okay, the profile type will not be fixed.

**00:17 Client:** It cannot be. Every single time, there will be a different profile type. If this profile type is your system's requirement, you can keep it, but it's not a requirement for me. For me, the device ID is what is important. The profile requirement isn't necessary on my end. Meaning, attach anything to whatever—what do I care about the profile, what will I do with it? I have no need to categorize them into profiles. If your syntax and conditions require a device profile, then you should make it user-defined. For example, I enter it via user input and it starts creating/populating the device profile here. Okay? Or give an option inside this dashboard like "Add Device Profile", because right now I don't see an option to add a device profile anywhere.

**01:02 Manager:** Yes, understood.

**01:03 Client:** You provide an "Add Device Profile" option, I add it, it appears in the listing under profiles, and then I can select it and give the device a name. That could be one process. But my requirement does not depend on device profiles. That's the first thing that must be settled.

**01:21 Manager:** Okay sir, one moment. I have a question here: regarding this profile type, suppose this is a temperature sensor, right? If it's a temperature sensor, we calculate degrees Celsius only because this type is defined, which is how its parameters—what should I call them—are determined by this type.

**01:43 Client:** You don't need to calculate degrees Celsius or anything at all in your internal program.

**01:47 Manager:** No sir, but at least to showcase it, we...

**01:49 Client:** No, I will handle all of that for you. When the data comes from my hardware to you—if I label it "sensor" on the front, then whether what follows is temperature will be defined by us. Because what mapping will happen now? Right now, you have built a simple structure. Okay? For Phase 1, according to my commitment for Phase 1, that was more than enough. Now for my second phase commitment: in the second phase, suppose I push sensor data like sensor 1, sensor 2, sensor 3, sensor 4. The data for sensor 1, sensor 2, sensor 3 arrives in your telemetry. Now for the gauges I need to create: currently you have built two gauges there, one for temperature and one for humidity. What if I want to display temperature on your humidity indicator, and humidity on the temperature indicator? How would I do that? There's no option for that right now. I need to be able to map it, right? Meaning, the data my hardware pushes to AWS, and the data I pull from there—I need to map it according to my graphs, only then will the data be visible to me properly.

**03:00 Manager:** Fair point.

**03:01 Client:** Did you understand the point I explained here?

**03:02 Manager:** Understood, understood. Yes, coming back to the profile type here—if it turns out to be necessary for our syntax, then we will provide an option to add a device profile.

**03:22 Client:** Good. You provide an option to add it, and whatever JSON formatting the profile uses should not be fixed. For example, just now when I went into the admin—meaning back to my company view—as soon as I go into your device register, say I created a company called EcoLoop, and inside that I created a device called "locking-one". When I enter the device register and look at the MQTT JSON formatting, it's fixed.

**03:55 Manager:** Okay.

**03:56 Client:** If I send data that doesn't match this format, I don't know how it will behave. Right now, motion is fixed—does that mean I have to send motion every single time? That's not a feasible possibility.

**04:12 Manager:** No, I'm slightly unclear here, sir. Meaning, like the JSON format you're seeing...

**04:17 Client:** Right now you go into device register, and you see the JSON format. From what I understand, what you've done with the JSON format is that based on the profile type, you made the JSON formatting specific. If I select "industrial temperature humidity", then in the JSON format I start seeing temperature and humidity. Likewise, if I pick another profile type, something else shows up. You made this specific; you pre-mapped it. I don't want this. It's not necessary that I... Again, what did I explain this morning? It's not necessary that a single device has only a single sensor.

**04:52 Manager:** So over there, you mean suppose we remove this—we remove flow rate, we remove temperature. Suppose over here we have 1, 2, 3, 4, let's assume, right...

**05:03 Client:** If you want a standard, you can say "no sir, send me a standard format"—that's the first option. The second option is what I just told you: I push data to you, and you get JSON formatting along with the device ID and name. The device ID is used for your mapping. That settles the story of how the device is identified. Now, when I'm plotting a graph and bringing data into that graph, I should have a configuration option. As soon as I click configure, whatever data I just pushed—whether it was formatted under the name "temperature" or under "sensor"—once I tag it, the data should start displaying. Right? We need to keep it this simple; let's not complicate it. Keep it in a very straightforward way: I send you JSON—meaning my hardware does. Don't tell me what I have to send. I sent it to you; you take that JSON format payload, and when you go to the dashboard to plot graphs and everything, there should be an option to tag it there. That's all we need to complete the loop. For me, a fixed JSON is useless, completely useless from every angle. In fact, it will create complications for me, so we don't want that there.

**06:29 Manager:** Okay sir, tell me this: when you attach sensors to a device—suppose you even put 10 sensors on one device—isn't it defined that a sensor is only meant to measure one specific thing? Let's say, what should I say, if it's a temperature sensor, it only senses temperature, right?

**06:48 Client:** Yes, no, look, what did I tell you? A device can have multiple sensors. Okay? One, two, three, four, ten sensors can be attached, agreed. Each sensor has a constant metric—meaning a constant feature, or you could call it a fixed role—if it's temperature, that means it will only sense temperature; it's not going to suddenly start sensing humidity. It won't change; meaning once my initial condition is set and I've configured the system for temperature, that means it stays for temperature. It won't be that it displays humidity instead of temperature. Whatever is dedicated to that specific point, its data remains fixed to that point and won't change.

**07:37 Manager:** Got it. So here, let's suppose, sir, like what we did with "indus-01", hello?

**07:44 Client:** Indus what? Yes, "indus-01" that you worked on, yes.

**07:47 Manager:** I worked on it. In that, suppose right now there is flow rate and temperature, right? Let's assume these two sensors for now, okay? Let's assume. And after this, suppose you want to add a third one, and let's assume that's for humidity, let's assume...

**08:08 Client:** Yes, say that again, say it once more.

**08:10 Manager:** Like right now, flow rate in it is, say, 25.4 and temperature is something or other—it has two parameters in it. Okay? Because... so your requirement is that to add a third one, it should be possible to add it right into this.

**08:31 Client:** Right now, whatever JSON formatting or profiling you configured it with made it fixed. Remove this configuration, and the JSON will stop being fixed. Exactly. So instead of this auto-generated JSON, what I push to you first—my hardware will push the data first and foremost. Once you receive the data, you'll see: device 1's data has arrived, I've received X and Y data points. If it just needs to be matched, I'll match it for you. That's all that's needed. Second thing, now tell me this: regarding its endpoint, when I generate a request, do I use your URL endpoint, or what do I use?

**09:15 Manager:** Our endpoint will be the URL itself, right.

**09:17 Client:** So for the URL endpoint, you've given me two URLs: one for the Core IoT bridge and one for the super admin. Which one do I use to send data?

**09:28 Manager:** No, no, no, you're asking about pushing data from the device, right? Yeah, yeah, for that, what should I say, right now you go to the user side...

**09:37 Client:** No, no, again you misunderstood. What you gave me was the topic path/extension: `tenants/ecoloop/device/device-id/publish`. That's a different thing; I'm not talking about that. I'm asking: currently, when I need to transmit or deliver data to you, when I go to AWS, I use the IoT broker URL—like `amazon.com` or whatever URL is on top—take a look at my code sometime. So will my endpoint be the endpoint/URL you provided, or what will it be?

**10:24 Manager:** It will be this one, sir. That's what I'm trying to explain to you—on the user side, in the user-side portal, remember what was provided inside device registry...

**10:35 Client:** That line is a different thing, buddy. How can we use that? We can't, how could that work? That's just a simple topic path of yours. A URL needs to come in front of it—like if I want to send data right now, I'd send it to something like `ecoloop.com/<topic>`, right?

**10:51 Manager:** Yeah, no, no, no, I understand now, I understand. Give me some time, sir, I will check with the team and ask about this.

**11:01 Client:** And about the Root CA—look, what happens here is there is a certificate, and there is a private key path. So we got the certificate and the key path. Okay? It generates with the `.key` extension. Yeah, yeah. Now what about the PEM, the AWS root CA certificate file? How do I get that? Where do I get that from?

**11:21 Manager:** What does the root CA file do, sir? What does it do?

**11:24 Client:** These three are your authentication files: certificate, private key, and the root CA which has a `.pem` extension. If you check, you'll see PEM.

**11:32 Manager:** PEM.

**11:33 Client:** Yes, you provided CRT and you provided `.key`. Yeah, yeah. But you haven't provided anything beyond that.

**11:42 Manager:** Oh, meaning maybe last time we didn't discuss this, or perhaps you forgot to mention it, or whatever it was—at that time you had only mentioned two.

**11:58 Client:** Now look, either this is fixed. Yes, it could be fixed; I don't know for sure either. Yeah, yeah, you had explained that much. So I'm not certain if it's fixed... Okay, tell me another thing: these certificates and keys are basically meant to authenticate with AWS, right? Isn't that so? Basically, that's what's happening. So right now, what I'm trying to understand—clarify one thing for me: will my hardware hit your server, or will it hit AWS's server?

**12:41 Manager:** It will hit AWS, and then display in our system, right?

**12:43 Client:** Meaning we are pushing data directly into AWS. That's what you mean and what I'm trying to understand, right? Explain this clearly to me, because our routing could change significantly based on this. Yeah, yeah, one minute, one minute, okay, sir, even I have doubts on this, let me talk to the developer once...

**13:04 Client:** Clear up this point, tell him: look, what is one route? I send it to you, you send it to AWS, and you pull it from there. Okay? That's one route. The other route is that I send it directly to AWS, and AWS passes it to you. Fair enough. But with AWS, double punching happens on my end. Yes. Because I push once, that's one call, and you also make a call to retrieve it. True. So that's a double hit, which means two of my tokens get consumed right there. If I just push it to you, you only push/store it there once; you won't need to double-hit it there. Won't need to. And if I go through your route, then the certificate and key wouldn't even be needed by my system or my hardware in that case.

**13:59 Manager:** Exactly.

**14:00 Client:** Understand this: whatever discussion we had when we sat down that day, in the hardware we designed, we were pushing data directly to AWS. That was why we provisioned all those certificates, keys, and everything. Fair point. But if I push through your server/PC or through your URL, then your URL/backend already has the key and certificate fixed for that particular device. Yes. Because we generated it on your system, you have a fixed URL and credentials; I'd only push data to your URL, and as soon as your URL is hit, it starts pushing data there. Okay. So this is currently a point of confusion—it's not clear to me yet. Yeah, we need to bring this to a consensus. See, in this case, many things... everything you built is fine, but there might be a bit of reverse engineering. Yeah, yeah, I understand sir, we anticipated that input would come from your side and we'd adapt it, and it's heading in the right direction. Because going via this route eliminates the penalty of double token consumption for me. Yes. In a single token I push to you; now how responsive your system is becomes important for us, because I'll be sending MQTT (or HTTP) to your server rather than directly to the IoT Core or AWS server.

**15:30 Manager:** Okay, alright.

**15:31 Client:** So what are the possibilities? Make a list of these points and clarify them: what are the benefits of going that way versus this way? And according to my understanding regarding the AWS IoT endpoint that I'm trying to figure out, it should be AWS's IoT broker endpoint, not what you told me earlier like "sir, use this endpoint"—that wasn't actually an endpoint.

**16:02 Manager:** Mm-hmm, yes, I feel the same way now.

**16:05 Client:** Because from what I understand right now, this URL you generate or the simulated data is also automatically pushing to a specific IoT endpoint, because you've only built a viewing layer, not an ingestion routing layer.

**16:19 Manager:** Built a viewing end, not a routing end, exactly, exactly.

**16:23 Client:** If there is no routing layer, then that won't work. Wait a second, let's open AWS and check, no matter how long it takes. Which ID did I give you—did I give you EcoLoop's or whose ID?

**16:36 Manager:** You gave EcoLoop's, let me check the chat for a minute... device notification EcoLoop 2021.

**16:51 Client:** I gave you the device certificate; the verification was sent to the EcoLoop 2021 one, right?

**16:58 Manager:** Yes, yes, EcoLoop 2021@gmail.com.

**17:02 Client:** It's the EcoLoop 2021 one, right? Yes, yes, EcoLoop 2021@gmail.com.

*(Sound of typing and navigating AWS console)*

**17:34 Manager:** Where is this going now, why isn't it accepting the login?

**17:53 Client:** Did you open AWS IoT?

**17:55 Manager:** I don't recall exactly which one. We did set up the web server, but why isn't my login working? Sign in to console... it's not signing in. When going to sign in to console, it never asked for an account ID from me until today... "don't have sign in" or "sign in as root", when I select sign in via root, root isn't available, now it requires plugging in a USB drive or passkey... AWS... why is it asking for an account ID?

*(Wait for login process)*

**18:52 Manager:** Shall we check in AWS IoT?

**18:53 Client:** In AWS to continue, I'll select sign in as root user... choose a passkey, cancel, don't want that, sign in to a different account, additional verification... damn, root is giving so much trouble. "IAM user account ID" it's asking for. Username, password, sign in using root user email, there is one at the bottom, yes, root user / IAM user, let's say root user, okay, let's try inserting the security key once... wait, how would I have the security key... yeah, was there a password for this, sir?

**19:53 Client:** Everything was provided to you, man. What account ID did you set up? Tell me the account ID, only then can I understand.

**20:00 Manager:** Yes, sir, let's do this a bit later because the other guy (developer) has it, and he is currently off—meaning unavailable right now—since he configured everything in this.

**20:17 Client:** No, he configured it, that's fine, but AWS IoT Core should be accessible. I had logged in earlier, but sign in to console isn't working. After going to sign in to console, it never asked for an account ID before... "don't have sign in" or "sign in as root"... if I select sign in via root, root isn't working, now it requires plugging in a USB drive or passkey... unrestricted AWS... why is it asking for an account ID?

**20:51 Manager:** Username, password, sign in using root user email, there's one at the bottom, yes, root user / IAM user, let's select root user, alright, let's try putting the security key once... wait, how would the security key be here... yeah, was there a password for this, sir?

**21:19 Client:** No, the password is fine, password is set. "Using a phone or tablet passkey for the AWS key, scan the QR with your phone or tablet." Hey, your guy has enabled passkeys, extra security, and everything!

**22:13 Manager:** Then I'll have to ask him once.

**22:15 Client:** Bro, tell him not to lock it down so hard that even I can't access AWS; tell him not to go completely rogue with security like that.

**22:21 Manager:** No, no, no, sir, this is something else, we are heading in the wrong direction, we aren't accessing it the right way. I'll ask him anyway, I understood. Let me note this down too. Yes, tell him clearly in writing—meaning, whatever this AWS account/ID setup is, don't lock us out of it, whoever your guy is. Tell him crystal clear that whatever he does with AWS, don't lock down the credentials or at least share the IDs with us. Earlier a verification code used to arrive, I remember that clearly, just one verification code used to come.

**22:58 Manager:** Exactly, that's how we used to log in as well.

**23:00 Client:** That's all that used to come, it was standard—the AWS verification code would arrive, exactly that. I remember very well and it was clear that we'd enter directly with AWS verification, nothing else needed. "IAM user account sign in, IAM user sign in account ID"—why all this is happening, I don't understand. It's not letting us into root user email either; it's asking for a passkey. It shouldn't have asked for a passkey, and that too requires your guy's specific passkey—either a hardware security key/USB or a passkey. Alright sir, I say keep this as an action item. We will understand this and resolve this issue. Okay, alright. Because I need access to this, as we have to monitor user counts and everything—it's your account and you should have full access. Yes, yes, alright.

**24:06 Client:** Second, how will I push data to you right now? I won't even be able to push data until you clarify everything for me. Yeah, yeah, clarity on this. Because until I have clarity, I won't even be able to proceed with that.

**24:19 Manager:** Alright, alright, I'll speak to him tomorrow or the day after. The more this gets delayed, the more our timeline slips, nothing else.

**24:26 Client:** No, exactly that. I'll message him today; once he sends it, I will forward it to you even tonight if possible.

**24:36 Manager:** Yeah, alright, give me clarity on these things, and I will also sit down today and try to initiate testing, which will give you good access.

**24:45 Client:** Exactly, exactly, that's what I want too. Once you get started, only then will we receive any response/feedback, and based on that, a lot of things will become clear moving forward. Just like the points I've encountered and shared with you, we need to understand and align on these things.

**25:00 Manager:** Yes, yes, alright sir, understood, we will look into it.

**25:03 Client:** Okay, okay.

***

## Meeting Summary

### 1. Core Client Requirements
*   **Flexible Device Profiles:** The client strongly rejects fixed device profile types in the "Super Admin" panel. They want the ability to add user-defined profiles dynamically or enter them via a text field during device creation.
*   **Sensor Mapping & UI Flexibility:** The client requires the ability to map any raw sensor data received from hardware to any gauge or indicator on the dashboard. They want a configuration interface where they can tag specific JSON data points (e.g., "sensor1") to specific visual elements (e.g., a temperature gauge).
*   **Dynamic JSON Formatting:** The MQTT JSON structure should not be hardcoded to a device profile. The client expects the dashboard to adapt to whatever JSON schema the hardware sends, rather than forcing the hardware to adhere to a predefined format.
*   **Data Routing Optimization:** The client wants to avoid "double-hitting" AWS (one hit to push data, one hit for the application to pull it), which consumes two tokens. They propose pushing data from the hardware directly to the application server's bridge/URL, which then handles the storage or onward transmission to AWS.

### 2. Technical Constraints/Integrations
*   **AWS IoT Integration:** The system uses AWS IoT. The client mentioned the need for authentication files: Certificate (CRT), Private Key (.key), and a Root PEM file.
*   **MQTT Communication:** Data is transmitted via MQTT with specific extensions (e.g., `tenants/ecoloop/device/device-id/publish`).
*   **Authentication & Security:** The AWS account currently has "Passkey" or hardware security (MFA/Physical Key) enabled, preventing the manager from logging in without specific credentials or account IDs.
*   **Hardware-Dashboard Parity:** The hardware is designed to send raw sensor data (e.g., `sensor1: 25.4`). The dashboard must be capable of interpreting these labels based on user-defined configurations.

### 3. Non-Technical Assumptions by the Manager (Need Tech Review)
*   **Fixed Profiles for Calculations:** The manager assumed that the "Profile Type" is necessary for the system to know which units to use (e.g., degree centigrade) or how to perform internal calculations. The client clarified that the hardware/config side should handle this, not a fixed profile type.
*   **End-point Misunderstanding:** The manager initially thought the client should hit the "user side" device registry URL, but the client clarified they need a direct MQTT bridge/routing endpoint.
*   **Routing Logic:** The manager assumed hardware would hit AWS directly and the dashboard would just "show" the data. The client’s proposal to hit the application server first represents a significant architectural change that needs review regarding server load and responsiveness.
*   **Root PEM Necessity:** The manager was unsure why a PEM (root) file is needed for authentication, assuming only the CRT and .key files were required. The dev team needs to confirm the full AWS IoT authentication handshake requirements.



Based on the transcript, the client’s reaction is a mix of **"You met the basic contract, but the architecture is too rigid for real-world use."**

Here is a breakdown of how the client feels about your MVP:

### 1. The "Yes": It meets the basic commitment
The client explicitly says at **02:08**:
> *"This is more than enough for phase one... for what my phase one commitment was."*

He acknowledges that you built what was discussed for the initial phase. He also says at **14:55**:
> *"You made everything fine, everything is good... but now there's a bit of reverse engineering [needed]."*

This suggests that as a **static demo**, the MVP is fine. It looks good and functions as a proof of concept.

### 2. The "No": It is too "Fixed" (Rigid)
This is where the client is frustrated. He feels the MVP was built with too many assumptions that don't match how hardware actually works. 
*   **He hates the "Fixed JSON":** He says at **06:05**, *"For me, fixed JSON is of no use... in any angle it’s of no use."*
*   **He hates the "Profile Types":** He feels that by forcing a device to be a "Temperature Sensor" or "Humidity Sensor" at the database level, you’ve made the system too stiff. 
*   **He thinks it’s too "Complicated":** He mentions several times that he wants it "simple." To him, "simple" means: *I phek data (I throw data), you just show it and let me map it.*

### 3. The "Frustration": He can't actually use it yet
The client’s "liking" of the MVP is overshadowed by two technical blockers:
*   **The Security Lockout:** He is quite annoyed that your team (the "banda") enabled Passkeys/MFA on the AWS account without giving him access. He says at **22:15** that he shouldn't be "left like a wild bull" (unrestricted access) and is frustrated that he’s locked out of his own account ID.
*   **Missing Connectivity:** Because the Root PEM file wasn't provided, he hasn't been able to see his own hardware data on your MVP yet. This makes the MVP feel like a "black box" to him.

### Overall Sentiment: **"Functional but Needs a Pivot"**
The client **likes the progress**, but he is **critical of the logic.** 

He views your MVP as a **Phase 1 "Showcase"** but believes the underlying engine needs to be "reverse engineered" to be more flexible (schema-less) before it can move to Phase 2. 

**The Tech Lead's takeaway:** He isn't asking you to scrap the MVP; he's asking you to **"unlock"** it. He wants you to move away from hardcoded data structures and toward a system where the user defines what the data means via the UI.





This conversation is a classic "Product vs. Engineering" friction point. The client is pushing for high flexibility (schema-less data ingestion), while the MVP appears to have been built with a more rigid, structured architecture (fixed profiles and hardcoded JSON structures).

As the **Tech Lead**, here is your "Action & Risk" report based on this transcript.

---

### 1. Critical Architectural Changes (The "Pivot")
The client is requesting a shift from a **Structured Model** to a **Mapping Model**.

*   **Dynamic Device Profiles:** 
    *   **Current MVP:** Likely uses an Enum or a fixed database table for "Profile Types" (e.g., Temperature Sensor, Flow Meter). 
    *   **Requirement:** The client wants to create profiles on the fly or treat the "Profile Type" as a non-mandatory metadata field.
*   **Schema-less JSON Ingestion:** 
    *   **Current MVP:** The UI/Backend likely expects a specific JSON key (e.g., `{"temp": 25}`) to render a gauge.
    *   **Requirement:** The client wants to send **any** JSON (e.g., `{"s1": 25}`) and use a "Configuration" screen on the dashboard to map `s1` to the Temperature Gauge. You will need to build a "Key-to-Widget" mapping logic.

### 2. Data Ingestion & Cost Optimization
The client is concerned about **AWS IoT Core costs (Tokens/Messages)**.

*   **The "Double Hit" Problem:** The client believes that sending data to AWS and then having the app pull it is inefficient/expensive.
*   **Proposed Proxy/Bridge:** They want the hardware to hit **your bridge/URL** first. 
    *   **Tech Lead Note:** If you act as the MQTT bridge, you are taking on the responsibility of message queuing, uptime, and scaling that AWS IoT Core usually handles. You need to evaluate if your current server can handle the MQTT load directly or if you should use an AWS Lambda/Kinesis firehose to mitigate the "double hit" while keeping the architecture robust.

### 3. Infrastructure & Security Blockers
There is a clear breakdown in credential management that is frustrating the client.

*   **MFA/Passkey Lockout:** The manager and client are unable to log into the AWS Console because someone on the tech team (likely under your lead) enabled **Passkeys/MFA** without sharing the physical key or secondary access. 
    *   **Immediate Action:** You need to identify who holds the MFA/Passkey and set up a shared "IAM User" for the client/manager so they aren't locked out.
*   **Missing Root CA (PEM file):** The hardware requires three files for a secure handshake: Certificate, Private Key, and **Root CA (Amazon Root CA 1)**. You only provided the first two. This is why their hardware cannot currently connect.

### 4. Technical Risks & "Manager Assumptions"
Your manager made several assumptions that you need to validate or correct:

*   **The "Calculations" Misconception:** The manager thought the "Profile Type" was needed to calculate units (Celsius/Fahrenheit). The client corrected him, stating the hardware or the dashboard mapping should handle display units, not a hardcoded backend profile.
*   **"Reverse Engineering" the MVP:** The client explicitly mentioned that the MVP feels like it needs "reverse engineering" because it's too specific. As Tech Lead, you need to decide if you can "unlock" the current codebase or if the ingestion engine needs a rewrite to be "key-value" based instead of "object-property" based.
*   **The Bridge URL:** The manager promised that a specific URL in the "user side registry" would work as an MQTT endpoint. This is likely a REST endpoint or a web-view URL, not a broker address. You need to provide the actual **MQTT Broker Endpoint** to the client.

---

### Suggested Immediate Next Steps for You:
1.  **Release the AWS Lock:** Disable the physical passkey requirement or provide an alternate login for the manager/client immediately.
2.  **Provide the Root CA:** Send the `AmazonRootCA1.pem` file to the client so they can test hardware connectivity.
3.  **Draft a "Mapping UI" spec:** Show the manager how you plan to allow users to "tag" JSON keys to dashboard widgets so the JSON doesn't have to be fixed.
4.  **Evaluate the "Direct-to-Server" MQTT bridge:** Check if your backend can handle raw MQTT traffic or if you should suggest an alternate AWS-native way to reduce "token" usage without losing the benefits of AWS IoT Core.