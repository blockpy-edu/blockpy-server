
def test_home_route(client):
    """Test the '/' route for correct status code and content."""
    response = client.get('/')
    assert response.status_code == 200
    # Use .data to access the response body and decode it
    assert b'Main Page' in response.data

def test_static_route(client):
    """Test the '/static/' route for correct status code."""
    response = client.get('/static/images/blockpy.png')
    assert response.status_code == 200


def test_whoami(client):
    response = client.get('/whoami')
    assert response.status_code == 200
    data = response.get_json()
    assert isinstance(data, dict)
    assert data['email'] == ''
    assert data['id']