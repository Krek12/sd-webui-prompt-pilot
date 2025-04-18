import { API_PREFIX, EXTENSION_ID } from 'shared/const/common';
import * as db_tag from 'database/tag';
import * as db_lora from 'database/lora';
import * as db_sg from 'database/suggestion';
import * as binder from 'ui/binder';
import * as context from 'ui/context';
import * as contextState from 'shared/state/context';
import { ResponseData } from 'shared/types/api';
import { fetchWithRetry } from 'shared/util';

declare function gradioApp(): HTMLElement;
declare function onUiLoaded(callback: VoidFunction): void;
declare function onOptionsChanged(callback: VoidFunction): void;

window.pilotIsActive = true;

export let resolveInitialized: ((value: boolean) => void) | null;
const initializedPromise = new Promise<boolean>((resolve) => {
    resolveInitialized = resolve;
});

onUiLoaded(() => {
    try {
        context.createContext(document.body);

        const textareaSelector = "*:is([id*='_toprow'] [id*='_prompt'], .prompt) textarea";
        const promptTextareas = gradioApp().querySelectorAll<HTMLTextAreaElement>(textareaSelector);
        promptTextareas.forEach((textarea) => {
            binder.bind(textarea as PilotTextArea);
        });

        const refreshButtonSelector = '.extra-network-control--refresh';
        const refreshButtons = gradioApp().querySelectorAll<HTMLDivElement>(refreshButtonSelector);
        refreshButtons.forEach((button) => {
            button.addEventListener('click', () => {
                fetch(`${API_PREFIX}/refresh`, { method: 'POST' }).then(async (res) => {
                    const resData: ResponseData | undefined = await res.json();
                    db_lora.initializeLoraModels(resData);
                });
            });
        });

        fetchWithRetry(`${API_PREFIX}/init`, { method: 'POST' }).then(async (res) => {
            const resData: ResponseData | undefined = await res.json();
            initializedPromise.then(() => {
                db_tag.initializeTagModels(resData);
                db_lora.initializeLoraModels(resData);
                db_sg.initializeSuggestionModels(resData);
                if (!contextState.isClosed()) {
                    context.updateContextPosition();
                }
            });
        });
    } catch (e) {
        console.error(e);
    }
});

onOptionsChanged(() => {
    window.pilotIsActive = window.opts[`${EXTENSION_ID}_enabled`] as boolean;

    if (resolveInitialized) {
        resolveInitialized(true);
        resolveInitialized = null;
    }
});
