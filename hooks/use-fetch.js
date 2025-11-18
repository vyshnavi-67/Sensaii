import { useState } from "react";
import { toast } from "sonner";

const useFetch = (cb) => {
  const [data, setData] = useState(undefined);
  const [loading, setLoading] = useState(null);
  const [error, setError] = useState(null);

  const fn = async (...args) => {
    setLoading(true);
    setError(null);

    try {
      const response = await cb(...args);
      setData(response);
      setError(null);

      // ✅ IMPORTANT: return response so caller (sendFn, finishFn) gets it
      return response;
    } catch (error) {
      setError(error);
      toast.error(error.message);
      return { error: error.message }; // optional: safe fallback
    } finally {
      setLoading(false);
    }
  };

  return { data, loading, error, fn, setData };
};

export default useFetch;
