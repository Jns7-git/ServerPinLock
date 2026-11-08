/**
 * @name ServerPinLock
 * @author JNS
 * @description Adds a local PIN screen to selected servers, with security-question recovery.
 * @version 1.3.0
 */

const ServerPinLockAvatar = ({guild, size = 38}) => {
    const React = BdApi.React;
    const h = React.createElement;
    const initials = (guild?.name || "?").trim().slice(0, 2).toUpperCase();
    const imageUrl = guild?.icon ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}${guild.icon.startsWith("a_") ? ".gif" : ".png"}?size=96` : null;
    return h("div", {style: {position: "relative", flex: `0 0 ${size}px`, width: size, height: size, display: "grid", placeItems: "center", overflow: "hidden", borderRadius: "10px", background: "#404249", color: "white", fontSize: size < 36 ? "11px" : "13px", fontWeight: 700}},
        initials,
        imageUrl ? h("img", {src: imageUrl, alt: "", onError: event => {event.currentTarget.style.display = "none";}, style: {position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover"}}) : null
    );
};

const SERVER_PIN_QUESTIONS = [
    "What was the name of your first pet?",
    "What was the name of your first school?",
    "What city were you born in?",
    "What was your childhood nickname?",
    "What was the first concert you attended?"
];

const ServerPinLockSettings = ({plugin}) => {
    const React = BdApi.React;
    const h = React.createElement;
    const [guilds, setGuilds] = React.useState([]);
    const [selectedId, setSelectedId] = React.useState("");
    const [stage, setStage] = React.useState("choose");
    const [oldPin, setOldPin] = React.useState("");
    const [pin, setPin] = React.useState("");
    const [confirmPin, setConfirmPin] = React.useState("");
    const [question, setQuestion] = React.useState(SERVER_PIN_QUESTIONS[0]);
    const [answer, setAnswer] = React.useState("");
    const [confirmAnswer, setConfirmAnswer] = React.useState("");
    const [feedback, setFeedback] = React.useState(null);
    const [saving, setSaving] = React.useState(false);
    const [locks, setLocks] = React.useState(plugin.getLocks());
    const [removingId, setRemovingId] = React.useState(null);
    const [removePinValue, setRemovePinValue] = React.useState("");

    React.useEffect(() => {
        setGuilds(plugin.getGuilds());
        const refresh = setInterval(() => setGuilds(plugin.getGuilds()), 3000);
        return () => clearInterval(refresh);
    }, []);

    const colors = {text: "#f2f3f5", muted: "#b5bac1", panel: "#2b2d31", field: "#1e1f22", line: "#3f4147", blue: "#5865f2", green: "#23a559"};
    const card = {background: "transparent", border: 0, borderTop: `1px solid ${colors.line}`, borderRadius: 0, padding: "16px 0", marginTop: "8px"};
    const label = {display: "block", fontSize: "12px", fontWeight: 600, color: colors.text, margin: "0 0 7px"};
    const field = {boxSizing: "border-box", width: "100%", padding: "9px 11px", borderRadius: "4px", border: `1px solid ${colors.line}`, background: colors.field, color: colors.text, outline: "none", fontSize: "14px"};
    const button = {border: 0, borderRadius: "4px", padding: "9px 13px", background: colors.blue, color: "white", fontSize: "13px", fontWeight: 600, cursor: "pointer"};
    const secondaryButton = {...button, background: "#4e5058"};
    const selectedGuild = guilds.find(guild => guild.id === selectedId);

    const beginSetup = () => {
        if (!selectedId) return setFeedback({type: "error", text: "Select a server first."});
        setOldPin(""); setPin(""); setConfirmPin(""); setQuestion(SERVER_PIN_QUESTIONS[0]); setAnswer(""); setConfirmAnswer("");
        setFeedback(null); setStage("pin"); setRemovingId(null);
    };

    const savePin = async () => {
        const existing = locks[selectedId];
        if (!selectedId) return setFeedback({type: "error", text: "Select a server first."});
        if (existing) {
            if (!oldPin) return setFeedback({type: "error", text: "Enter the current PIN to change this server's settings."});
            setSaving(true);
            try {
                if (!await plugin.verifyPin(oldPin, existing)) {
                    setSaving(false);
                    return setFeedback({type: "error", text: "The current PIN is incorrect."});
                }
            }
            catch (error) {
                setSaving(false);
                return setFeedback({type: "error", text: "Could not verify the current PIN: " + error.message});
            }
            setSaving(false);
        }
        if (!/^\d{4,12}$/.test(pin)) return setFeedback({type: "error", text: "Use a PIN with 4 to 12 digits."});
        if (pin !== confirmPin) return setFeedback({type: "error", text: "The PINs do not match."});

        if (!SERVER_PIN_QUESTIONS.includes(question)) return setFeedback({type: "error", text: "Choose a security question from the list."});
        if (plugin.normalizeAnswer(answer).length < 1) return setFeedback({type: "error", text: "Enter a security answer."});
        if (plugin.normalizeAnswer(answer) !== plugin.normalizeAnswer(confirmAnswer)) return setFeedback({type: "error", text: "The security answers do not match."});

        setSaving(true);
        try {
            await plugin.setPin(selectedId, pin, question, answer);
            setLocks(plugin.getLocks());
            setOldPin(""); setPin(""); setConfirmPin(""); setQuestion(SERVER_PIN_QUESTIONS[0]); setAnswer(""); setConfirmAnswer("");
            setFeedback({type: "success", text: `PIN saved for ${selectedGuild?.name || "this server"}.`});
            setStage("choose");
        }
        catch (error) {
            setFeedback({type: "error", text: "Could not save the PIN: " + error.message});
        }
        finally {
            setSaving(false);
        }
    };

    const cancelRemove = () => {setRemovingId(null); setRemovePinValue(""); setFeedback(null);};
    const confirmRemove = async (guildId) => {
        const lock = locks[guildId];
        if (!removePinValue) return setFeedback({type: "error", text: "Enter the server PIN to remove its protection."});
        setSaving(true);
        try {
            if (!await plugin.verifyPin(removePinValue, lock)) {
                setFeedback({type: "error", text: "Incorrect PIN. Protection was not removed."});
                setSaving(false);
                return;
            }
            plugin.removePin(guildId);
            setLocks(plugin.getLocks());
            setRemovingId(null); setRemovePinValue("");
            setFeedback({type: "success", text: "Server protection removed."});
        }
        catch (error) {
            setFeedback({type: "error", text: "Could not verify the PIN: " + error.message});
        }
        finally {setSaving(false);}
    };

    const header = h("div", {style: {marginBottom: "8px"}},
        h("h2", {style: {margin: 0, color: colors.text, fontSize: "18px", lineHeight: 1.3, fontWeight: 600}}, "Server PIN Lock"),
        h("div", {style: {marginTop: "4px", color: colors.muted, fontSize: "13px"}}, "Choose which servers should ask for a PIN.")
    );
    const notice = h("p", {style: {margin: "12px 0 8px", paddingLeft: "10px", borderLeft: "2px solid #4e5058", color: colors.muted, fontSize: "12px", lineHeight: 1.5}},
        "This is a local screen only; it does not secure your Discord account or server. Recovery answers are stored locally as hashes."
    );
    const steps = h("div", {style: {margin: "14px 0 4px", color: colors.muted, fontSize: "12px"}},
        stage === "choose" ? "Step 1 of 2 · Select a server" : "Step 2 of 2 · Set a PIN and recovery answer"
    );

    let content;
    if (stage === "choose") {
        const protectedIds = Object.keys(locks);
        content = h(React.Fragment, null,
            h("section", {style: card},
                h("div", {style: {fontSize: "15px", fontWeight: 700, color: colors.text, marginBottom: "5px"}}, "Choose a server"),
                h("p", {style: {margin: "0 0 14px", color: colors.muted, fontSize: "13px", lineHeight: 1.5}}, "Select a server to protect. Click Next to create its PIN and recovery question."),
                guilds.length ? h("div", {style: {display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(210px,1fr))", gap: "8px", maxHeight: "230px", overflowY: "auto", padding: "2px 3px 2px 0"}}, guilds.map(guild => {
                    const active = selectedId === guild.id;
                    const protectedServer = !!locks[guild.id];
                    return h("button", {key: guild.id, type: "button", onClick: () => {setSelectedId(guild.id); setFeedback(null);}, style: {minWidth: 0, display: "flex", alignItems: "center", gap: "9px", padding: "8px", borderRadius: "5px", border: `1px solid ${active ? colors.blue : "transparent"}`, background: active ? "#34363c" : "transparent", textAlign: "left", cursor: "pointer", color: colors.text}},
                        h(ServerPinLockAvatar, {guild, size: 38}),
                        h("span", {style: {flex: 1, minWidth: 0}},
                            h("span", {style: {display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: "13px", fontWeight: 650}}, guild.name),
                            h("span", {style: {display: "block", marginTop: "3px", fontSize: "11px", color: colors.muted}}, protectedServer ? "PIN enabled" : "Not protected")
                        ),
                        h("span", {style: {fontSize: "13px", color: active ? "#aeb4ff" : "#72767d"}}, active ? "●" : "○")
                    );
                })) : h("div", {style: {padding: "18px", background: "#2b2d31", borderRadius: "8px", color: colors.muted, fontSize: "13px", textAlign: "center"}}, "Loading your servers…"),
                h("div", {style: {display: "flex", justifyContent: "flex-end", marginTop: "14px"}}, h("button", {style: {...button, opacity: selectedId ? 1 : 0.55}, disabled: !selectedId, onClick: beginSetup}, "Next  →"))
            ),
            h("section", {style: card},
                h("div", {style: {display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px"}},
                    h("div", {style: {fontSize: "15px", fontWeight: 700, color: colors.text}}, "Protected servers"),
                    h("span", {style: {padding: "3px 8px", borderRadius: "20px", background: "#313338", color: colors.muted, fontSize: "11px", fontWeight: 700}}, String(protectedIds.length))
                ),
                protectedIds.length ? h("div", {style: {display: "grid", gap: "8px"}}, protectedIds.map(guildId => {
                    const guild = guilds.find(item => item.id === guildId) || {id: guildId, name: "Unknown server"};
                    const isRemoving = removingId === guildId;
                    return h("div", {key: guildId, style: {padding: "9px 0", borderBottom: `1px solid ${colors.line}`}},
                        h("div", {style: {display: "flex", alignItems: "center", gap: "10px"}},
                            h(ServerPinLockAvatar, {guild, size: 34}),
                            h("span", {style: {flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: "13px", color: colors.text}}, guild.name),
                            h("span", {style: {fontSize: "11px", color: lockHasRecovery(locks[guildId]) ? "#70d99a" : "#f0c674", marginRight: "5px"}}, lockHasRecovery(locks[guildId]) ? "Recovery set" : "Set recovery"),
                            !isRemoving ? h("button", {style: {border: 0, background: "transparent", color: "#f08080", fontSize: "12px", fontWeight: 700, cursor: "pointer"}, onClick: () => {setRemovingId(guildId); setRemovePinValue(""); setFeedback(null);}}, "Remove") : h("button", {style: {border: 0, background: "transparent", color: colors.muted, fontSize: "12px", cursor: "pointer"}, onClick: cancelRemove}, "Cancel")
                        ),
                        isRemoving ? h("div", {style: {display: "flex", gap: "8px", alignItems: "center", marginTop: "10px", paddingTop: "10px", borderTop: `1px solid ${colors.line}`}},
                            h("input", {type: "password", inputMode: "numeric", autoComplete: "current-password", maxLength: 12, placeholder: "Enter this server's PIN", value: removePinValue, onChange: event => setRemovePinValue(event.target.value.replace(/\D/g, "")), onKeyDown: event => {if (event.key === "Enter") confirmRemove(guildId);}, style: {...field, padding: "8px 10px", fontSize: "12px"}}),
                            h("button", {style: {...button, padding: "8px 10px", background: "#da373c", whiteSpace: "nowrap", opacity: saving ? 0.6 : 1}, disabled: saving, onClick: () => confirmRemove(guildId)}, saving ? "Checking…" : "Confirm remove")
                        ) : null
                    );
                })) : h("div", {style: {padding: "12px 0", color: colors.muted, fontSize: "13px"}}, "No servers are protected yet.")
            )
        );
    }
    else {
        const existing = locks[selectedId];
        content = h("section", {style: card},
            h("div", {style: {display: "flex", alignItems: "center", gap: "10px", marginBottom: "5px"}}, h(ServerPinLockAvatar, {guild: selectedGuild || {name: "?"}, size: 34}), h("div", {style: {fontSize: "15px", fontWeight: 700, color: colors.text}}, existing ? "Change server PIN" : "Protect this server")),
            h("p", {style: {margin: "0 0 18px 44px", color: colors.muted, fontSize: "13px"}}, selectedGuild?.name || "Selected server"),
            existing ? h(React.Fragment, null,
                h("label", {style: label, htmlFor: "server-pin-current"}, "CURRENT PIN"),
                h("input", {id: "server-pin-current", style: {...field, maxWidth: "420px", letterSpacing: "4px", marginBottom: "16px"}, type: "password", inputMode: "numeric", autoComplete: "current-password", maxLength: 12, value: oldPin, onChange: event => setOldPin(event.target.value.replace(/\D/g, "")), placeholder: "Enter the current PIN"})
            ) : null,
            h("label", {style: label, htmlFor: "server-pin-new"}, "NEW PIN  ·  4–12 DIGITS"),
            h("input", {id: "server-pin-new", style: {...field, maxWidth: "420px", letterSpacing: "4px", marginBottom: "16px"}, type: "password", inputMode: "numeric", autoComplete: "new-password", maxLength: 12, value: pin, onChange: event => setPin(event.target.value.replace(/\D/g, "")), placeholder: "Enter a new PIN"}),
            h("label", {style: label, htmlFor: "server-pin-confirm"}, "CONFIRM NEW PIN"),
            h("input", {id: "server-pin-confirm", style: {...field, maxWidth: "420px", letterSpacing: "4px", marginBottom: "18px"}, type: "password", inputMode: "numeric", autoComplete: "new-password", maxLength: 12, value: confirmPin, onChange: event => setConfirmPin(event.target.value.replace(/\D/g, "")), placeholder: "Enter the new PIN again"}),
            h("div", {style: {height: "1px", background: colors.line, margin: "4px 0 16px"}}),
            h("div", {style: {fontSize: "14px", fontWeight: 700, marginBottom: "5px", color: colors.text}}, "PIN recovery"),
            h("p", {style: {margin: "0 0 14px", color: colors.muted, fontSize: "12px", lineHeight: 1.5}}, "Choose a question and set an answer you will remember. Answers can be one character; a made-up answer is fine."),
            h("label", {style: label, htmlFor: "security-question"}, "SECURITY QUESTION"),
            h("select", {id: "security-question", style: {...field, maxWidth: "520px", marginBottom: "14px", appearance: "auto"}, value: question, onChange: event => setQuestion(event.target.value)},
                SERVER_PIN_QUESTIONS.map(item => h("option", {key: item, value: item}, item))
            ),
            h("label", {style: label, htmlFor: "security-answer"}, "ANSWER"),
            h("input", {id: "security-answer", style: {...field, maxWidth: "420px", marginBottom: "14px"}, type: "password", autoComplete: "off", maxLength: 100, value: answer, onChange: event => setAnswer(event.target.value), placeholder: "Your answer"}),
            h("label", {style: label, htmlFor: "security-answer-confirm"}, "CONFIRM ANSWER"),
            h("input", {id: "security-answer-confirm", style: {...field, maxWidth: "420px"}, type: "password", autoComplete: "off", maxLength: 100, value: confirmAnswer, onChange: event => setConfirmAnswer(event.target.value), placeholder: "Enter the same answer again"}),
            h("div", {style: {display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", marginTop: "20px"}},
                h("button", {style: secondaryButton, onClick: () => {setStage("choose"); setFeedback(null);}}, "← Back"),
                h("button", {style: {...button, opacity: saving ? 0.65 : 1}, disabled: saving, onClick: savePin}, saving ? "Saving…" : "Save PIN & recovery")
            )
        );
    }

    return h("div", {style: {boxSizing: "border-box", width: "100%", maxWidth: "720px", margin: "0 auto", padding: "22px", color: colors.text, fontFamily: "inherit"}},
        header, notice, steps, content,
        feedback ? h("div", {role: "status", style: {marginTop: "14px", padding: "10px 12px", borderRadius: "7px", background: feedback.type === "success" ? "#173b2a" : "#3b2426", color: feedback.type === "success" ? "#70d99a" : "#ff8c8c", fontSize: "13px"}}, feedback.text) : null
    );
};

function lockHasRecovery(lock) {
    return !!(lock && typeof lock.question === "string" && lock.question.length >= 5 && lock.answerSalt && lock.answerHash);
}

module.exports = class ServerPinLock {
    constructor() {
        this.api = new BdApi("ServerPinLock");
        this.currentGuildId = null;
        this.unlockedGuildId = null;
        this.overlay = null;
        this.interval = null;
        this.handleSubmit = this.handleSubmit.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleClick = this.handleClick.bind(this);
    }

    start() {
        this.locks = this.api.Data.load("locks") || {};
        this.interval = setInterval(() => this.checkCurrentServer(), 350);
        this.checkCurrentServer();
    }

    stop() {
        if (this.interval) clearInterval(this.interval);
        this.interval = null;
        this.removeOverlay();
        this.currentGuildId = null;
        this.unlockedGuildId = null;
    }

    getLocks() {
        return this.locks || this.api.Data.load("locks") || {};
    }

    getGuilds() {
        try {
            const collection = BdApi.Webpack.Stores.GuildStore?.getGuilds?.();
            if (!collection) return [];
            return Object.values(collection)
                .filter(guild => guild && guild.id)
                .map(guild => ({id: String(guild.id), name: guild.name || "Unnamed server", icon: guild.icon || null}))
                .sort((a, b) => a.name.localeCompare(b.name, "en"));
        }
        catch (error) {
            this.api.Logger.error("Could not read the server list", error);
            return [];
        }
    }

    normalizeAnswer(answer) {
        return String(answer).normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");
    }

    async deriveHash(value, saltHex) {
        const salt = this.hexToBytes(saltHex);
        const key = await window.crypto.subtle.importKey("raw", new TextEncoder().encode(value), "PBKDF2", false, ["deriveBits"]);
        const bits = await window.crypto.subtle.deriveBits({name: "PBKDF2", salt, iterations: 150000, hash: "SHA-256"}, key, 256);
        return this.bytesToHex(new Uint8Array(bits));
    }

    async createSaltedHash(value) {
        const bytes = new Uint8Array(16);
        window.crypto.getRandomValues(bytes);
        const salt = this.bytesToHex(bytes);
        return {salt, hash: await this.deriveHash(value, salt)};
    }

    async setPin(guildId, pin, question, answer) {
        const pinData = await this.createSaltedHash(pin);
        const answerData = await this.createSaltedHash(this.normalizeAnswer(answer));
        this.locks = {...this.getLocks(), [guildId]: {...pinData, question, answerSalt: answerData.salt, answerHash: answerData.hash}};
        this.api.Data.save("locks", this.locks);
    }

    async changePin(guildId, pin) {
        const oldLock = this.getLocks()[guildId];
        if (!oldLock) throw new Error("Server PIN data was not found.");
        const pinData = await this.createSaltedHash(pin);
        this.locks = {...this.getLocks(), [guildId]: {...oldLock, ...pinData}};
        this.api.Data.save("locks", this.locks);
    }

    async verifyPin(pin, lock) {
        return this.verifyValue(pin, lock.salt, lock.hash);
    }

    async verifyRecoveryAnswer(answer, lock) {
        if (!lockHasRecovery(lock)) return false;
        return this.verifyValue(this.normalizeAnswer(answer), lock.answerSalt, lock.answerHash);
    }

    async verifyValue(value, salt, expectedHash) {
        const candidate = await this.deriveHash(value, salt);
        if (typeof expectedHash !== "string" || candidate.length !== expectedHash.length) return false;
        let mismatch = 0;
        for (let index = 0; index < candidate.length; index++) mismatch |= candidate.charCodeAt(index) ^ expectedHash.charCodeAt(index);
        return mismatch === 0;
    }

    bytesToHex(bytes) {
        return Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
    }

    hexToBytes(hex) {
        if (typeof hex !== "string" || !/^(?:[0-9a-f]{2})+$/i.test(hex)) throw new Error("Invalid stored PIN data.");
        return new Uint8Array(hex.match(/.{2}/g).map(byte => parseInt(byte, 16)));
    }

    removePin(guildId) {
        this.locks = {...this.getLocks()};
        delete this.locks[guildId];
        this.api.Data.save("locks", this.locks);
        if (this.currentGuildId === guildId) this.removeOverlay();
    }

    getCurrentGuildId() {
        const match = window.location.pathname.match(/^\/channels\/([^/]+)/);
        if (!match || match[1] === "@me") return null;
        return match[1];
    }

    checkCurrentServer() {
        const guildId = this.getCurrentGuildId();
        if (guildId !== this.currentGuildId) {
            this.currentGuildId = guildId;
            this.unlockedGuildId = null;
        }
        const lock = guildId && this.getLocks()[guildId];
        if (lock && this.unlockedGuildId !== guildId) this.showOverlay(guildId);
        else this.removeOverlay();
    }

    showOverlay(guildId) {
        if (this.overlay && this.overlay.dataset.guildId === guildId) return;
        this.removeOverlay();
        const overlay = document.createElement("div");
        overlay.dataset.guildId = guildId;
        overlay.style.cssText = "position:fixed;inset:0;z-index:2147483647;background:#111214;display:flex;align-items:center;justify-content:center;color:#f2f3f5;font-family:inherit;";
        overlay.innerHTML = `<div style="box-sizing:border-box;width:min(380px,calc(100vw - 36px));padding:24px;background:#2b2d31;border:1px solid #3f4147;border-radius:8px;text-align:left">
            <div data-unlock-screen>
                <h2 style="margin:0 0 6px;font-size:18px;font-weight:600">Server locked</h2>
                <p style="color:#b5bac1;margin:0 0 16px;font-size:13px">Enter your PIN to continue.</p>
                <form data-pin-form><input data-pin-input type="password" inputmode="numeric" autocomplete="current-password" maxlength="12" aria-label="PIN" placeholder="PIN" style="box-sizing:border-box;width:100%;padding:10px;border:1px solid #4e5058;border-radius:4px;background:#1e1f22;color:#f2f3f5;font-size:15px;outline:none"><p data-error style="min-height:18px;margin:7px 0;color:#f23f43;font-size:12px"></p><button type="submit" style="padding:9px 13px;border:0;border-radius:4px;background:#5865f2;color:white;font-size:13px;font-weight:600;cursor:pointer">Unlock</button></form>
                <button type="button" data-forgot style="margin-top:12px;border:0;background:transparent;color:#c9cdfb;font-size:12px;cursor:pointer">Forgot PIN?</button>
            </div>
            <div data-recovery-screen style="display:none">
                <h2 style="margin:0 0 6px;font-size:18px;font-weight:600">Reset your PIN</h2>
                <p data-question style="color:#dcddde;margin:0 0 14px;font-size:13px"></p>
                <form data-recovery-form>
                    <input data-answer type="password" autocomplete="off" aria-label="Security answer" placeholder="Security answer" style="box-sizing:border-box;width:100%;padding:10px;border:1px solid #4e5058;border-radius:4px;background:#1e1f22;color:#f2f3f5;margin-bottom:8px">
                    <input data-new-pin type="password" inputmode="numeric" maxlength="12" autocomplete="new-password" aria-label="New PIN" placeholder="New PIN (4–12 digits)" style="box-sizing:border-box;width:100%;padding:10px;border:1px solid #4e5058;border-radius:4px;background:#1e1f22;color:#f2f3f5;margin-bottom:8px">
                    <input data-new-pin-confirm type="password" inputmode="numeric" maxlength="12" autocomplete="new-password" aria-label="Confirm new PIN" placeholder="Confirm new PIN" style="box-sizing:border-box;width:100%;padding:10px;border:1px solid #4e5058;border-radius:4px;background:#1e1f22;color:#f2f3f5">
                    <p data-recovery-error style="min-height:18px;margin:8px 0;color:#f23f43;font-size:12px"></p>
                    <button type="submit" style="padding:9px 13px;border:0;border-radius:4px;background:#5865f2;color:white;font-size:13px;font-weight:600;cursor:pointer">Reset PIN</button>
                </form>
                <button type="button" data-back-to-pin style="margin-top:12px;border:0;background:transparent;color:#c9cdfb;font-size:12px;cursor:pointer">Back</button>
            </div>
            <p style="font-size:11px;line-height:1.5;color:#949ba4;margin:16px 0 0">This is a local visual lock, not account or server security.</p>
        </div>`;
        const question = overlay.querySelector("[data-question]");
        const lock = this.getLocks()[guildId];
        question.textContent = lockHasRecovery(lock) ? lock.question : "No recovery question is set for this server. Set one in plugin settings while you still know the current PIN.";
        overlay.addEventListener("submit", this.handleSubmit);
        overlay.addEventListener("keydown", this.handleKeyDown);
        overlay.addEventListener("click", this.handleClick);
        document.body.appendChild(overlay);
        this.overlay = overlay;
        setTimeout(() => overlay.querySelector("[data-pin-input]")?.focus(), 50);
    }

    handleClick(event) {
        const overlay = this.overlay;
        if (!overlay) return;
        if (event.target.closest("[data-forgot]")) {
            const lock = this.getLocks()[overlay.dataset.guildId];
            if (!lockHasRecovery(lock)) {
                overlay.querySelector("[data-error]").textContent = "No recovery question is set. Configure one in plugin settings.";
                return;
            }
            overlay.querySelector("[data-unlock-screen]").style.display = "none";
            overlay.querySelector("[data-recovery-screen]").style.display = "block";
            setTimeout(() => overlay.querySelector("[data-answer]")?.focus(), 20);
        }
        if (event.target.closest("[data-back-to-pin]")) {
            overlay.querySelector("[data-recovery-screen]").style.display = "none";
            overlay.querySelector("[data-unlock-screen]").style.display = "block";
            overlay.querySelector("[data-pin-input]")?.focus();
        }
    }

    handleKeyDown(event) {
        if (event.key === "Escape") event.preventDefault();
    }

    async handleSubmit(event) {
        event.preventDefault();
        const overlay = this.overlay;
        if (!overlay) return;
        const guildId = overlay.dataset.guildId;
        const lock = this.getLocks()[guildId];
        if (!lock) return this.removeOverlay();

        if (event.target.matches("[data-pin-form]")) {
            const input = overlay.querySelector("[data-pin-input]");
            const error = overlay.querySelector("[data-error]");
            const button = event.target.querySelector("button[type=submit]");
            if (!input.value) {error.textContent = "Enter your PIN to continue."; input.focus(); return;}
            button.disabled = true; button.textContent = "Checking…";
            try {
                if (await this.verifyPin(input.value, lock)) {
                    this.unlockedGuildId = guildId;
                    this.removeOverlay();
                }
                else {input.value = ""; error.textContent = "Incorrect PIN. Please try again."; input.focus();}
            }
            catch (exception) {error.textContent = "Could not verify the PIN. Check plugin data and try again."; this.api.Logger.error("PIN verification failed", exception);}
            finally {if (this.overlay === overlay) {button.disabled = false; button.textContent = "Unlock server";}}
            return;
        }

        if (event.target.matches("[data-recovery-form]")) {
            const answer = overlay.querySelector("[data-answer]");
            const newPin = overlay.querySelector("[data-new-pin]");
            const confirmPin = overlay.querySelector("[data-new-pin-confirm]");
            const error = overlay.querySelector("[data-recovery-error]");
            const button = event.target.querySelector("button[type=submit]");
            if (!lockHasRecovery(lock)) {error.textContent = "No recovery question is set for this server."; return;}
            if (!/^\d{4,12}$/.test(newPin.value)) {error.textContent = "Use a new PIN with 4 to 12 digits."; newPin.focus(); return;}
            if (newPin.value !== confirmPin.value) {error.textContent = "The new PINs do not match."; confirmPin.focus(); return;}
            button.disabled = true; button.textContent = "Verifying…";
            try {
                if (!await this.verifyRecoveryAnswer(answer.value, lock)) {
                    answer.value = ""; error.textContent = "Incorrect security answer."; answer.focus(); return;
                }
                await this.changePin(guildId, newPin.value);
                this.unlockedGuildId = guildId;
                this.removeOverlay();
                this.api.UI.showToast("PIN reset. Server unlocked.", {type: "success"});
            }
            catch (exception) {error.textContent = "Could not reset the PIN: " + exception.message; this.api.Logger.error("PIN recovery failed", exception);}
            finally {if (this.overlay === overlay) {button.disabled = false; button.textContent = "Verify & reset PIN";}}
        }
    }

    removeOverlay() {
        if (!this.overlay) return;
        this.overlay.removeEventListener("submit", this.handleSubmit);
        this.overlay.removeEventListener("keydown", this.handleKeyDown);
        this.overlay.removeEventListener("click", this.handleClick);
        this.overlay.remove();
        this.overlay = null;
    }

    getSettingsPanel() {
        return BdApi.React.createElement(ServerPinLockSettings, {plugin: this});
    }
};
