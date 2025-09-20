import React, { useState } from 'react';

const TransactionTestPage = () => {
  // State for the input IDs
  const [sellerId, setSellerId] = useState('');
  const [buyerId, setBuyerId] = useState('');
  const [orderIds, setOrderIds] = useState({
    retail: '',
    wholesale: '',
    auction: '',
    service: ''
  });
  const [lastResponse, setLastResponse] = useState(null);
  const [error, setError] = useState(null);

  // Function to send payload
  const sendTransaction = async (type) => {
    const orderId = orderIds[type];
    if (!sellerId || !buyerId || !orderId) {
      alert("Please fill in sellerId, buyerId, and the orderId for type: " + type);
      return;
    }
    // choose a random amount between 2000 and 4000
    const amount = Math.floor(Math.random() * (4000 - 2000 + 1)) + 2000;

    const payload = {
      transaction_type: type,
      sellerId: sellerId.trim(),
      buyerId: buyerId.trim(),
      orderId: orderId.trim(),
      amount
    };

    try {
      const resp = await fetch('/api/pay-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      const data = await resp.json();
      if (!resp.ok) {
        setError(data.error || "Unknown error");
        setLastResponse(null);
      } else {
        setLastResponse(data);
        setError(null);
      }
    } catch (err) {
      console.error('Error sending transaction', err);
      setError(err.message);
      setLastResponse(null);
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: 'auto' }}>
      <h2>Transaction Test Page</h2>

      <div style={{ marginBottom: '20px' }}>
        <label>
          Seller ID:{' '}
          <input
            type="text"
            value={sellerId}
            onChange={(e) => setSellerId(e.target.value)}
            placeholder="Enter sellerId"
            style={{ width: '100%' }}
          />
        </label>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label>
          Buyer ID:{' '}
          <input
            type="text"
            value={buyerId}
            onChange={(e) => setBuyerId(e.target.value)}
            placeholder="Enter buyerId"
            style={{ width: '100%' }}
          />
        </label>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <h4>Order IDs for each transaction type</h4>
        {['retail', 'wholesale', 'auction', 'service'].map((type) => (
          <div key={type} style={{ marginBottom: '10px' }}>
            <label>
              {type.charAt(0).toUpperCase() + type.slice(1)} Order ID:{' '}
              <input
                type="text"
                value={orderIds[type]}
                onChange={(e) =>
                  setOrderIds({ ...orderIds, [type]: e.target.value })
                }
                placeholder={`Enter ${type} order ID`}
                style={{ width: '100%' }}
              />
            </label>
          </div>
        ))}
      </div>

      <div style={{ marginBottom: '20px' }}>
        <h4>Make a Payment</h4>
        {['retail', 'wholesale', 'auction', 'service'].map((type) => (
          <button
            key={type}
            onClick={() => sendTransaction(type)}
            style={{
              margin: '5px',
              padding: '10px 20px',
              cursor: 'pointer'
            }}
          >
            Pay {type.charAt(0).toUpperCase() + type.slice(1)} Order
          </button>
        ))}
      </div>

      <div style={{ marginTop: '20px' }}>
        <h4>Response</h4>
        {error && (
          <div style={{ color: 'red', marginBottom: '10px' }}>
            Error: {error}
          </div>
        )}
        {lastResponse && (
          <pre
            style={{
              background: '#f4f4f4',
              padding: '10px',
              borderRadius: '5px'
            }}
          >
            {JSON.stringify(lastResponse, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
};

export default TransactionTestPage;
