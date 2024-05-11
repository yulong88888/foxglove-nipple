import React from "react";

export const useMountEffect = (fun: React.EffectCallback): void => React.useEffect(fun, [fun]);
