import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";
import { findByPropsLazy } from "@webpack";
import { FluxDispatcher } from "@webpack/common";

const PresenceStore = findByPropsLazy("getStatus", "getState");
const UserStore = findByPropsLazy("getCurrentUser", "getUsers");
const ChannelStore = findByPropsLazy("getChannel", "getDMFromUserId");

let isPluginActive = false;
let hasInterceptor = false;
let pluginStartTime = 0;

export default definePlugin({
    name: "HideOfflineMessages",
    description: "Make 'invisible' people truly invisible! You won't see their messages until the next reboot 👻",
    authors: [Devs.Ven],

    start() {
        isPluginActive = true;
        pluginStartTime = Date.now() - 60000;

        if (!FluxDispatcher || !UserStore) return;

        if (hasInterceptor) return;

        const isAuthorOffline = (authorId: string): boolean => {
            if (!PresenceStore || !PresenceStore.getStatus) return false;
            const status = PresenceStore.getStatus(authorId);
            return status === "offline" || status === "invisible" || !status;
        };

        const shouldHideMessage = (msg: any): boolean => {
            const myId = UserStore?.getCurrentUser()?.id;
            const authorId = msg?.author?.id;
            
            if (!authorId || authorId === myId) return false;
            if (msg.author?.bot) return false;
            if (msg.type !== 0 && msg.type !== 19) return false;
            if (msg.guild_id) return false;
            if (msg.referenced_message?.author?.id === myId) return false;

            const mentions = msg.mentions;
            if (Array.isArray(mentions)) {
                for (let i = 0; i < mentions.length; i++) {
                    if (mentions[i]?.id === myId) return false;
                }
            }

            if (msg.timestamp && Date.parse(msg.timestamp) < pluginStartTime) return false;

            const channel = ChannelStore?.getChannel(msg.channel_id);
            if (!channel || channel.guild_id || (channel.type !== 1 && channel.type !== 3)) return false;

            return isAuthorOffline(authorId);
        };

        const handleDispatch = (event: any) => {
            if (!isPluginActive) return false;

            if (!event || event.type !== "MESSAGE_CREATE" || !event.message) return false;

            try {
                if (shouldHideMessage(event.message)) {
                    return true;
                }
            } catch (err) {
                console.warn("[HideOfflineMessages] Intercept error:", err);
            }
            return false;
        };

        FluxDispatcher.addInterceptor(handleDispatch);
        hasInterceptor = true;
    },

    stop() {
        isPluginActive = false;
    }
});
