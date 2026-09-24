import { JOB_NAMES } from "../../constants/queue";
import { clickQueue } from "../queues/click.queue";
import { ClickRecorder } from "./clickRecorder";

export const clickRecorder = new ClickRecorder({
    enqueue: (events) => clickQueue.add(JOB_NAMES.CLICK_BATCH, { events }),
});
