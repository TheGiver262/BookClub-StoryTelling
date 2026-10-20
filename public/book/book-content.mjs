const HOME = 'https://clbyeusachbkhn.weebly.com/';
const ACTIVITIES = HOME + 'ho7840t-2727896ng.html';
const GALLERY = HOME + 'gallery.html';
const HUST = 'https://hust.edu.vn/vi/news/hoat-dong-chung/yeu-sach-nhu-sinh-vien-bach-khoa-655055.html';
const FACEBOOK = 'https://www.facebook.com/CLBYeuSachBachKhoaHaNoi/';
const UPLOAD = 'Ảnh CLB do người dùng cung cấp';
const photo = (file, caption, source, position = '50% 50%') => ({ file, caption, source, position });

export const activities = [
  { title: 'Cho mượn sách miễn phí', photo: photo('loans-book-table.jpg', 'Bàn sách của CLB Yêu Sách Bách Khoa', UPLOAD) },
  { title: 'Đêm Sách', photo: photo('book-night-group.jpg', 'Cùng nhau trong một buổi Đêm Sách', UPLOAD, '50% 65%') },
  { title: 'Sinh hoạt & chia sẻ sách', photo: photo('historical-reading.jpg', 'Một buổi đọc và chia sẻ · tư liệu website CLB', ACTIVITIES) },
  { title: 'Ngày Sách Việt Nam', photo: photo('vietnam-book-day-booth.jpg', 'Gian sách tại Ngày Sách và Văn hóa đọc Việt Nam 2026', UPLOAD) },
  { title: 'Dã ngoại & Big Game', photo: photo('outdoors-big-game.jpg', 'Những thử thách cùng nhau trong Big Game Gen 13', UPLOAD) },
  { title: 'Tuyển thành viên', photo: photo('recruitment-interview.jpg', 'Một cuộc trò chuyện trong vòng phỏng vấn', UPLOAD, '65% 50%') },
];

export const galleryActivities = activities;

export const chapters = [
  { id: 'origin', kind: 'story', name: 'Một khởi đầu từ tình yêu sách', title: 'Từ một<br><em>tình yêu sách.</em>', kicker: 'Từ những trang sách đầu tiên', sources: [HOME], photos: [photo('historical-team.png', 'Những gương mặt thời kỳ đầu · ảnh tư liệu từ website CLB', HOME)], lines: [
    '<span>Ngày thành lập</span><strong>16.09.2013</strong>',
    'Giữa những giờ học và nhịp sống sinh viên, một cuốn sách có thể mở ra một khoảng trời khác. Yêu Sách Bách Khoa ra đời từ mong muốn để những người thích đọc có một nơi gặp gỡ, trao đổi và cùng nhau học hỏi.',
    'Hoạt động tự nguyện, phi lợi nhuận, CLB kết nối bạn đọc ở Bách Khoa và các trường đại học tại Hà Nội. Không cần đọc thật nhiều mới có thể bắt đầu; chỉ cần bạn tò mò và sẵn lòng chia sẻ điều mình tìm thấy trong trang sách.',
    'Từ tủ sách cho mượn miễn phí đến những buổi sinh hoạt, Đêm Sách và Ngày Sách Việt Nam, việc đọc dần bước ra khỏi trang giấy. Mỗi hoạt động là một dịp để lắng nghe một góc nhìn khác, thử một điều mới và đưa những điều đã đọc vào cuộc sống.',
    'Qua nhiều thế hệ, các thành viên cùng chăm sóc tủ sách, chuẩn bị chương trình và viết tiếp câu chuyện của CLB. Chúng mình đến vì sách, rồi ở lại vì những người bạn — cùng đọc, cùng làm và cùng trưởng thành.',
  ], compactLines: [
    'Để sinh viên cùng đọc, trao đổi và học hỏi.',
    'Tự nguyện, phi lợi nhuận; kết nối bạn đọc ở Bách Khoa và Hà Nội.',
    'Tủ sách miễn phí, Đêm Sách, sinh hoạt: cùng đọc và sẻ chia.',
      'Đến vì sách, ở lại vì tình bạn.',
  ] },
  { id: 'people', kind: 'people', name: 'Những người viết tiếp', kicker: 'Con người làm nên Yêu Sách', sources: [FACEBOOK, HUST], photos: [
    photo('members-current-group.jpg', 'Những gương mặt đang viết tiếp câu chuyện Yêu Sách', UPLOAD),
    photo('members-current-friends.jpg', 'Những người bạn cùng chung tình yêu sách', UPLOAD),
    photo('members-anniversary-13.jpg', 'Một dấu mốc: Yêu Sách Bách Khoa tròn 13 tuổi', UPLOAD),
    photo('members-current-campus.jpg', 'Cùng nhau dưới mái nhà Yêu Sách Bách Khoa', UPLOAD),
  ], lines: [
    'Từ những gương mặt đầu tiên, câu chuyện được viết tiếp qua nhiều thế hệ sinh viên.',
    'Một dấu mốc để nhớ. Những kỷ niệm để cùng nhau viết tiếp.',
  ] },
  { id: 'activities', kind: 'gallery', name: 'Sách đưa chúng mình đi đâu?', sources: [FACEBOOK, ACTIVITIES], items: galleryActivities },
  { id: 'free-loans', kind: 'story', name: 'Cho mượn sách miễn phí', title: 'Một cuốn sách.<br>Nhiều lượt <em>chuyền tay.</em>', kicker: 'Từ tình yêu sách đến tủ sách chung', sources: [ACTIVITIES], photos: [
    activities[0].photo,
    photo('loan-user.jpg', 'Những cuốn sách chờ đến tay người đọc', UPLOAD),
  ], lines: [
    'Để việc đọc dễ bắt đầu hơn, CLB xây dựng tủ sách chung và cho sinh viên mượn miễn phí.',
    'Những buổi trực là lúc bạn chọn sách, gặp thành viên CLB và mang một câu chuyện về nhà.',
    'Bạn có thể giữ chỗ online rồi nhận tại buổi trực thứ 3 hoặc thứ 5 đã chọn. Mỗi đơn giữ một cuốn.',
    'Khi trả lại, cuốn sách tiếp tục hành trình đến một người đọc khác.',
  ] },
  { id: 'book-night', kind: 'story', name: 'Đêm Sách', title: 'Khi câu chuyện<br>được <em>cất thành lời.</em>', kicker: 'Từ đọc một mình đến sẻ chia cùng nhau', sources: [FACEBOOK], photos: [
    activities[1].photo,
    photo('book-night-sharing.jpg', 'Một khoảnh khắc trong buổi chia sẻ sách', UPLOAD),
  ], lines: [
    'Có những cuốn sách khiến người đọc muốn kể lại ngay điều vừa tìm thấy.',
    'Đêm Sách là một không gian để giới thiệu sách hay, lắng nghe cảm nhận và gặp những người cùng quan tâm.',
    'Mỗi người mang tới một câu chuyện. Cuộc gặp trở thành nơi những góc nhìn cùng mở ra.',
    'Và từ một đêm gặp gỡ, việc đọc được tiếp nối trong những buổi sinh hoạt thường kỳ.',
  ] },
  { id: 'weekly', kind: 'story', name: 'Sinh hoạt hàng tuần', title: 'Gặp nhau đều đặn.<br>Đọc sâu <em>hơn một chút.</em>', kicker: 'Giữ cho việc đọc trở thành một thói quen', sources: [ACTIVITIES, HUST], photos: [
    activities[2].photo,
    photo('historical-trip.png', 'Một buổi chia sẻ về sách · ảnh tư liệu gallery', GALLERY),
  ], lines: [
    'Trong những buổi sinh hoạt định kỳ, thành viên chia sẻ nội dung và điều mình tâm đắc từ sách.',
    'Có lúc cùng đọc, có lúc thảo luận một chủ đề hoặc đặt câu hỏi cho nhau.',
    'Một ý tưởng được nói ra có thể trở thành góc nhìn mới của người bên cạnh.',
    'Từ những buổi gặp nhỏ, chúng mình mang câu chuyện đọc sách đến một không gian rộng hơn.',
  ] },
  { id: 'vietnam-book-day', kind: 'story', name: 'Ngày Sách Việt Nam', title: 'Từ một trang sách.<br>Đến ngày hội <em>của người đọc.</em>', kicker: 'Ngày Sách và Văn hóa đọc Việt Nam', sources: [FACEBOOK], photos: [
    activities[3].photo,
    photo('vietnam-book-day-talk.jpg', 'Thảo luận về sách điện tử và sách giấy', UPLOAD, '60% 55%'),
  ], lines: [
    'Ngày Sách Việt Nam là dịp để tình yêu đọc được nhìn thấy, được kể lại và lan tỏa.',
    'Tại gian sách, thành viên CLB cùng giới thiệu những cuốn sách và gặp thêm những người bạn yêu đọc.',
    'Trên sân khấu, câu hỏi “Sách điện tử có thay thế sách giấy được không?” mở ra những góc nhìn về việc đọc trong thời đại số.',
    'Cùng chuẩn bị một ngày hội, chúng mình có thêm trải nghiệm làm việc và những kỷ niệm để mang theo.',
  ] },
  { id: 'outdoors', kind: 'story', name: 'Dã ngoại cùng nhau', title: 'Gấp sách lại.<br>Mở thêm một <em>khoảng trời.</em>', kicker: 'Những trang thanh xuân ở bên ngoài lớp học', sources: [FACEBOOK], photos: [
    activities[4].photo,
    photo('outdoors-group.jpg', 'Một buổi đi chơi cùng nhau', UPLOAD),
  ], lines: [
    'Bên cạnh sách còn có những chuyến đi, hoạt động ngoài trời và buổi gặp gỡ để hiểu nhau hơn.',
    'Một buổi dã ngoại hay những thử thách Big Game là dịp cùng phối hợp, trò chuyện và hiểu thêm về đồng đội.',
    'Có những câu chuyện chỉ được kể khi cùng bước ra ngoài và dành thời gian cho nhau.',
    'Và rồi, mỗi mùa mới lại chờ thêm những gương mặt mới.',
  ] },
  { id: 'recruitment', kind: 'story', name: 'Tuyển thành viên', title: 'Một chỗ trong CLB.<br>Một hành trình <em>của bạn.</em>', kicker: 'Những trang tiếp theo được viết bằng người mới', sources: [FACEBOOK], photos: [
    photo('recruitment-artemis.jpg', 'Artemis · hình ảnh một đợt tuyển thành viên', UPLOAD),
    activities[5].photo,
  ], lines: [
    'Mỗi đợt tuyển thành viên mở ra cơ hội gặp những người cùng sở thích và thử sức trong một tập thể.',
    'Bạn có thể bắt đầu từ tình yêu đọc sách, rồi khám phá việc làm nội dung, truyền thông hay tổ chức hoạt động.',
    'Chúng mình không cần bạn đã biết mọi điều. Một tinh thần sẵn sàng học hỏi là một khởi đầu đẹp.',
    'Từ những người gặp nhau vì sách, câu chuyện Yêu Sách Bách Khoa vẫn tiếp tục.',
  ] },
  { id: 'slogan', kind: 'slogan', name: 'Mở sách, đọc tương lai', sources: [HOME], illustrations: [
    { file: 'slogan-open-v7.png', alt: 'Một bạn sinh viên mở cuốn sách trên tay' },
    { file: 'slogan-future-v7.png', alt: 'Từ cuốn sách mở, mầm cây, thế giới và những trang giấy bay lên bầu trời' },
  ] },
];
